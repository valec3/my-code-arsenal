import type { Command } from 'commander';
import pc from 'picocolors';
import {
  moveIssuesToSprint,
  type SprintMoveReport,
  type SprintMoveResult,
} from '../application/move-issues-to-sprint';
import { closeDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { EXIT } from '../shared/exit-codes';
import { log } from '../shared/logger';
import { openProjectDatabase } from './project-db';
import { cachedProjectKey, createProjectGateway } from './project-gateway';
import { parseBoardId, parseSprintId } from './sprint-options';

interface SprintMoveCommandOptions {
  board?: string;
  dryRun: boolean;
  json: boolean;
}

export function registerSprintMoveCommand(program: Command): void {
  program
    .command('sprint-move')
    .argument('<project>', 'nombre del proyecto (carpeta en projects/)')
    .argument('<sprintId>', 'ID del sprint, obtenido con seiri sprints')
    .argument('<keys...>', 'issues a mover, por ejemplo ENG-353 ENG-354')
    .description('Mueve issues existentes a un sprint')
    .option('--board <id>', 'ID del board si hay mas de uno')
    .option('--dry-run', 'valida el sprint sin mover issues', false)
    .option('--json', 'salida JSON para agentes', false)
    .action(
      async (
        project: string,
        sprintIdValue: string,
        keys: string[],
        options: SprintMoveCommandOptions
      ) => {
        const { db } = openProjectDatabase(project);

        try {
          const store = new SqliteIssueStore(db);
          const projectKey = cachedProjectKey(store, project);
          const gateway = createProjectGateway(project, projectKey);
          const sprintId = parseSprintId(sprintIdValue);
          const boardId = parseBoardId(options.board);

          if (!options.json) {
            log.title(
              `sprint-move ${keys.length} issues -> sprint ${sprintId}${options.dryRun ? ' (dry-run)' : ''}`
            );
            log.info(`Proyecto "${project}" -> ${projectKey}`);
          }

          const report = await moveIssuesToSprint(gateway, projectKey, keys, {
            sprintId,
            boardId,
            dryRun: options.dryRun,
            onStart: options.json
              ? undefined
              : (board, sprint) => {
                  log.info(
                    `Board "${board.name}" (${board.id}) · sprint "${sprint.name}" (${sprint.id}, ${sprint.state})`
                  );
                },
            onIssue: options.json
              ? undefined
              : (result, index, total) => printIssue(result, index, total, sprintId),
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

function printIssue(
  result: SprintMoveResult,
  index: number,
  total: number,
  sprintId: number
): void {
  const label = `${index}/${total} ${result.key}`;

  if (result.outcome === 'MOVED') {
    console.log(`${pc.green('[ok]')} ${label} -> sprint ${sprintId}`);
    return;
  }

  if (result.outcome === 'DRY_RUN') {
    console.log(`${pc.dim('[dry]')} ${label} -> sprint ${sprintId}`);
    return;
  }

  console.error(`${pc.red('[error]')} ${label} ${result.error ?? 'no se pudo mover'}`);
}

function printSummary(report: SprintMoveReport): void {
  const moved = report.results.filter((result) => result.outcome === 'MOVED');
  const planned = report.results.filter((result) => result.outcome === 'DRY_RUN');
  const failed = report.results.filter((result) => result.outcome === 'FAILED');

  if (report.dryRun) {
    if (planned.length > 0) {
      log.success(
        `Dry-run: ${planned.length} issues se moverian al sprint "${report.sprint.name}". No se cambio nada.`
      );
    }
    if (failed.length > 0) {
      log.error(`${failed.length} issues fallarian.`);
    }
    return;
  }

  if (moved.length > 0) {
    log.success(`Movidas ${moved.length} issues al sprint "${report.sprint.name}".`);
  }
  if (failed.length > 0) {
    log.error(`${failed.length} fallaron. Revisa el error y volve a correr sprint-move.`);
  }
  if (moved.length === 0 && failed.length === 0) {
    log.info('No habia issues para mover.');
  }
}
