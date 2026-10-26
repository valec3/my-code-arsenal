import type { Command } from 'commander';
import pc from 'picocolors';
import {
  transitionIssues,
  type TransitionIssueResult,
  type TransitionReport,
} from '../application/transition-issues';
import { closeDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { EXIT } from '../shared/exit-codes';
import { log } from '../shared/logger';
import { openProjectDatabase } from './project-db';
import { cachedProjectKey, createProjectGateway } from './project-gateway';

interface TransitionCommandOptions {
  to: string;
  dryRun: boolean;
  json: boolean;
}

export function registerTransitionCommand(program: Command): void {
  program
    .command('transition')
    .argument('<project>', 'nombre del proyecto (carpeta en projects/)')
    .argument('<keys...>', 'issues a mover, por ejemplo ENG-337 ENG-338')
    .description('Mueve issues a otro estado usando las transiciones del workflow')
    .requiredOption('--to <status>', 'estado destino, por ejemplo Done')
    .option('--dry-run', 'muestra la transicion disponible sin tocar Jira', false)
    .option('--json', 'salida JSON para agentes', false)
    .action(async (project: string, keys: string[], options: TransitionCommandOptions) => {
      const { db } = openProjectDatabase(project);

      try {
        const store = new SqliteIssueStore(db);
        const projectKey = cachedProjectKey(store, project);
        const gateway = createProjectGateway(project, projectKey);

        if (!options.json) {
          log.title(
            `transition ${keys.length} issues -> ${options.to}${options.dryRun ? ' (dry-run)' : ''}`
          );
          log.info(`Proyecto "${project}" -> ${projectKey}`);
        }

        const report = await transitionIssues(
          { store, gateway },
          keys,
          {
            targetStatus: options.to,
            dryRun: options.dryRun,
            onIssue: options.json
              ? undefined
              : (result, index, total) => printIssue(result, index, total),
          }
        );

        const failed = report.results.filter((result) => result.outcome === 'FAILED').length;
        const changed = report.results.length - failed;
        const exitCode =
          failed === 0 ? EXIT.OK : changed > 0 ? EXIT.PARTIAL : EXIT.VALIDATION;

        if (options.json) {
          console.log(JSON.stringify({ ...report, exitCode }, null, 2));
        } else {
          printSummary(report);
        }

        process.exitCode = exitCode;
      } finally {
        closeDatabase(db);
      }
    });
}

function printIssue(result: TransitionIssueResult, index: number, total: number): void {
  const label = `${index}/${total} ${result.key}`;

  if (result.outcome === 'TRANSITIONED') {
    console.log(
      `${pc.green('[ok]')} ${label} ${result.from} -> ${result.to} (${result.transition?.name ?? 'transicion'})`
    );
    return;
  }

  if (result.outcome === 'ALREADY') {
    console.log(`${pc.dim('[skip]')} ${label} ya estaba en ${result.to}`);
    return;
  }

  if (result.outcome === 'DRY_RUN') {
    console.log(
      `${pc.dim('[dry]')} ${label} ${result.from} -> ${result.to} via "${result.transition?.name ?? ''}"`
    );
    if (result.available.length > 0) {
      console.log(pc.dim(`        disponibles: ${result.available.join(', ')}`));
    }
    return;
  }

  console.error(`${pc.red('[error]')} ${label} ${result.error ?? 'no se pudo transicionar'}`);
  if (result.available.length > 0) {
    console.error(pc.dim(`        transiciones disponibles: ${result.available.join(', ')}`));
  }
}

function printSummary(report: TransitionReport): void {
  const transitioned = report.results.filter((result) => result.outcome === 'TRANSITIONED');
  const already = report.results.filter((result) => result.outcome === 'ALREADY');
  const planned = report.results.filter((result) => result.outcome === 'DRY_RUN');
  const failed = report.results.filter((result) => result.outcome === 'FAILED');

  if (report.dryRun) {
    if (planned.length > 0) {
      log.success(`Dry-run: ${planned.length} issues listos. No se cambio nada.`);
    }
    if (already.length > 0) {
      log.info(`${already.length} ya estaban en ${report.targetStatus}.`);
    }
    if (failed.length > 0) {
      log.error(`${failed.length} issues no tienen transicion directa a ${report.targetStatus}.`);
    }
    return;
  }

  if (transitioned.length > 0) {
    log.success(`Movidas ${transitioned.length} issues a ${report.targetStatus}.`);
  }
  if (already.length > 0) {
    log.info(`${already.length} ya estaban en ${report.targetStatus}.`);
  }
  if (failed.length > 0) {
    log.error(`${failed.length} fallaron. Revisa el error y volve a correr transition.`);
  }
  if (transitioned.length === 0 && already.length === 0 && failed.length === 0) {
    log.info('No habia issues para mover.');
  }
}
