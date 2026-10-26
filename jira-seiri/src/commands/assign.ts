import type { Command } from 'commander';
import pc from 'picocolors';
import {
  assignIssues,
  type AssignIssueResult,
  type AssignReport,
} from '../application/assign-issues';
import { closeDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { EXIT } from '../shared/exit-codes';
import { log } from '../shared/logger';
import { openProjectDatabase } from './project-db';
import { cachedProjectKey, createProjectGateway } from './project-gateway';

interface AssignCommandOptions {
  dryRun: boolean;
  json: boolean;
}

export function registerAssignCommand(program: Command): void {
  program
    .command('assign')
    .argument('<project>', 'nombre del proyecto (carpeta en projects/)')
    .argument('<accountId>', 'accountId del usuario, obtenido con seiri users')
    .argument('<keys...>', 'issues a asignar, por ejemplo ENG-346 ENG-347')
    .description('Asigna issues existentes a un usuario de Jira')
    .option('--dry-run', 'muestra el plan sin asignar en Jira', false)
    .option('--json', 'salida JSON para agentes', false)
    .action(
      async (
        project: string,
        accountId: string,
        keys: string[],
        options: AssignCommandOptions
      ) => {
        const { db } = openProjectDatabase(project);

        try {
          const store = new SqliteIssueStore(db);
          const projectKey = cachedProjectKey(store, project);
          const gateway = createProjectGateway(project, projectKey);

          if (!options.json) {
            log.title(
              `assign ${keys.length} issues -> ${accountId}${options.dryRun ? ' (dry-run)' : ''}`
            );
            log.info(`Proyecto "${project}" -> ${projectKey}`);
          }

          const report = await assignIssues(gateway, keys, {
            accountId,
            dryRun: options.dryRun,
            onIssue: options.json
              ? undefined
              : (result, index, total) => printIssue(result, index, total),
          });

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
      }
    );
}

function printIssue(result: AssignIssueResult, index: number, total: number): void {
  const label = `${index}/${total} ${result.key}`;

  if (result.outcome === 'ASSIGNED') {
    console.log(`${pc.green('[ok]')} ${label} -> ${result.accountId}`);
    return;
  }

  if (result.outcome === 'DRY_RUN') {
    console.log(`${pc.dim('[dry]')} ${label} -> ${result.accountId}`);
    return;
  }

  console.error(`${pc.red('[error]')} ${label} ${result.error ?? 'no se pudo asignar'}`);
}

function printSummary(report: AssignReport): void {
  const assigned = report.results.filter((result) => result.outcome === 'ASSIGNED');
  const planned = report.results.filter((result) => result.outcome === 'DRY_RUN');
  const failed = report.results.filter((result) => result.outcome === 'FAILED');

  if (report.dryRun) {
    if (planned.length > 0) {
      log.success(`Dry-run: ${planned.length} issues se asignarian. No se cambio nada.`);
    }
    if (failed.length > 0) {
      log.error(`${failed.length} issues fallarian.`);
    }
    return;
  }

  if (assigned.length > 0) {
    log.success(`Asignadas ${assigned.length} issues a ${report.accountId}.`);
  }
  if (failed.length > 0) {
    log.error(`${failed.length} fallaron. Revisa el error y volve a correr assign.`);
  }
  if (assigned.length === 0 && failed.length === 0) {
    log.info('No habia issues para asignar.');
  }
}
