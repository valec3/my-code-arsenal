import type { Command } from 'commander';
import pc from 'picocolors';
import {
  applyMigration,
  type ApplyItemEvent,
  type ApplyResult,
} from '../application/apply-migration';
import { loadProjectEnv } from '../config/env';
import { SeiriError } from '../domain/errors';
import { closeDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { SqliteMigrationStore } from '../infrastructure/db/migration-store';
import { createJiraGateway } from '../infrastructure/jira/gateway';
import type { IssueStore } from '../ports/issue-store';
import type { JiraGateway } from '../ports/jira-gateway';
import { EXIT } from '../shared/exit-codes';
import { log } from '../shared/logger';
import { parseThreshold } from '../shared/parse';
import { loadMigrationFile } from './load-migration';
import { openProjectDatabase } from './project-db';

interface ApplyCommandOptions {
  dryRun: boolean;
  allowDuplicates: boolean;
  threshold: string;
  json: boolean;
}

export function registerApplyCommand(program: Command): void {
  program
    .command('apply')
    .argument('<file>', 'archivo migrations/*.json ya validado')
    .description('Aplica una migracion en Jira y actualiza la base local (idempotente)')
    .option('--dry-run', 'muestra el plan sin tocar Jira ni la base', false)
    .option('--allow-duplicates', 'aplica aunque validate detecte duplicados', false)
    .option('--threshold <n>', 'similitud 0-100 para marcar duplicado', '80')
    .option('--json', 'salida JSON para agentes', false)
    .action(async (file: string, options: ApplyCommandOptions) => {
      const threshold = parseThreshold(options.threshold);
      const loaded = loadMigrationFile(file);
      const { db } = openProjectDatabase(loaded.migration.project);

      try {
        const store = new SqliteIssueStore(db);
        const migrations = new SqliteMigrationStore(db);
        const projectKey = cachedProjectKey(store, loaded.migration.project);
        const createGateway = options.dryRun
          ? undefined
          : () => createProjectGateway(loaded.migration.project, projectKey);

        if (!options.json) {
          log.title(`apply ${loaded.filename}${options.dryRun ? ' (dry-run)' : ''}`);
          log.info(
            `Proyecto "${loaded.migration.project}" -> ${projectKey} · ${loaded.migration.items.length} items`
          );
          if (options.dryRun) {
            log.detail('Sin red y sin escrituras: solo se valida y se muestra el plan.');
          }
        }

        const result = await applyMigration(
          { store, migrations, createGateway },
          loaded.migration,
          {
            file: loaded.path,
            projectKey,
            checksum: loaded.checksum,
            description: loaded.migration.description,
            dryRun: options.dryRun,
            allowDuplicates: options.allowDuplicates,
            threshold,
            onItem: options.json ? undefined : printItemEvent,
          }
        );

        const exitCode = result.status === 'PARTIAL' ? EXIT.PARTIAL : EXIT.OK;

        if (options.json) {
          console.log(JSON.stringify({ ...result, exitCode }, null, 2));
        } else {
          printSummary(result);
        }

        process.exitCode = exitCode;
      } finally {
        closeDatabase(db);
      }
    });
}

function createProjectGateway(project: string, projectKey: string): JiraGateway {
  const env = loadProjectEnv(project);

  if (env.projectKey !== projectKey) {
    throw new SeiriError(
      `JIRA_PROJECT_KEY (${env.projectKey}) no coincide con la base local (${projectKey}).`,
      'CONFIG',
      `Revisa projects/${project}/.env o corre seiri pull ${project}.`
    );
  }

  return createJiraGateway(
    { host: env.host, email: env.email, apiToken: env.apiToken },
    { storyPointsField: env.storyPointsField }
  );
}

function cachedProjectKey(store: IssueStore, project: string): string {
  const keys = store.listProjectKeys();

  if (keys.length === 0) {
    throw new SeiriError(
      `La base local de "${project}" no tiene proyectos sincronizados.`,
      'CONFIG',
      `Corre seiri pull ${project} antes de aplicar.`
    );
  }

  if (keys.length > 1) {
    throw new SeiriError(
      `La base tiene varios proyectos (${keys.join(', ')}); se espera una base por proyecto.`,
      'CONFIG'
    );
  }

  return keys[0];
}

function printItemEvent(event: ApplyItemEvent): void {
  const label = `${event.index}/${event.total} [${event.localRef}]`;

  if (event.status === 'CREATED') {
    console.log(`${pc.green('[ok]')} ${label} -> ${event.issueKey}`);
    return;
  }

  if (event.status === 'SKIPPED') {
    console.log(`${pc.dim('[skip]')} ${label} ya existia`);
    return;
  }

  console.error(`${pc.red('[error]')} ${label} ${event.error ?? ''}`);
}

function printSummary(result: ApplyResult): void {
  if (result.duplicates.length > 0) {
    log.title(`Duplicados permitidos (${result.duplicates.length})`);
    for (const duplicate of result.duplicates) {
      const target = duplicate.source === 'existing'
        ? `${duplicate.key} "${duplicate.summary}"`
        : `local_ref "${duplicate.otherRef}"`;
      log.warn(`[${duplicate.ref}] ${duplicate.score}% vs ${target}`);
    }
  }

  if (result.status === 'DRY_RUN') {
    log.title('Plan');
    for (const entry of result.plan) {
      const parent = entry.parent ?? '(sin parent)';
      log.plain(`  - [${entry.localRef}] ${entry.type} -> ${parent} · ${entry.summary}`);
    }
    log.plain('');
    log.success(`Dry-run: ${result.plan.length} items listos. No se creo nada.`);
    return;
  }

  if (result.status === 'SKIPPED') {
    log.success('Ya estaba aplicada con el mismo checksum. Nada que hacer.');
    return;
  }

  if (result.status === 'PARTIAL') {
    log.title('Resultado parcial');
    for (const entry of result.created) {
      log.info(`creada ${entry.issueKey} <- ${entry.localRef}`);
    }
    for (const failure of result.failures) {
      log.error(`[${failure.localRef}] ${failure.error}`);
    }
    log.plain('');
    log.error(
      `Parcial: ${result.created.length} creadas. Corregi el error y volve a correr apply: retoma desde el item fallido.`
    );
    return;
  }

  if (result.created.length > 0) {
    log.success(`Creadas ${result.created.length} issues: ${result.created.map((entry) => entry.issueKey).join(', ')}`);
  }
  if (result.skipped.length > 0) {
    log.info(`Retomadas ${result.skipped.length} ya creadas en una corrida anterior.`);
  }
  log.success(`Migracion "${result.filename}" registrada como SUCCESS.`);
}
