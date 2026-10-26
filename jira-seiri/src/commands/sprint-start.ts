import type { Command } from 'commander';
import {
  startSprint,
  type StartSprintReport,
} from '../application/start-sprint';
import { closeDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { EXIT } from '../shared/exit-codes';
import { log } from '../shared/logger';
import { openProjectDatabase } from './project-db';
import { cachedProjectKey, createProjectGateway } from './project-gateway';
import { parseBoardId, parseSprintId } from './sprint-options';

interface SprintStartCommandOptions {
  board?: string;
  dryRun: boolean;
  json: boolean;
}

export function registerSprintStartCommand(program: Command): void {
  program
    .command('sprint-start')
    .argument('<project>', 'nombre del proyecto (carpeta en projects/)')
    .argument('<sprintId>', 'ID del sprint, obtenido con seiri sprints')
    .description('Inicia un sprint futuro')
    .option('--board <id>', 'ID del board si hay mas de uno')
    .option('--dry-run', 'valida el sprint sin iniciarlo', false)
    .option('--json', 'salida JSON para agentes', false)
    .action(
      async (
        project: string,
        sprintIdValue: string,
        options: SprintStartCommandOptions
      ) => {
        const { db } = openProjectDatabase(project);

        try {
          const store = new SqliteIssueStore(db);
          const projectKey = cachedProjectKey(store, project);
          const gateway = createProjectGateway(project, projectKey);
          const sprintId = parseSprintId(sprintIdValue);
          const boardId = parseBoardId(options.board);

          if (!options.json) {
            log.title(`sprint-start ${sprintId}${options.dryRun ? ' (dry-run)' : ''}`);
            log.info(`Proyecto "${project}" -> ${projectKey}`);
          }

          const report = await startSprint(gateway, projectKey, sprintId, {
            boardId,
            dryRun: options.dryRun,
          });

          if (options.json) {
            console.log(JSON.stringify({ ...report, exitCode: EXIT.OK }, null, 2));
            return;
          }

          printReport(report);
        } finally {
          closeDatabase(db);
        }
      }
    );
}

function printReport(report: StartSprintReport): void {
  log.info(`Board "${report.board.name}" (${report.board.id}) · ${report.board.type}`);

  if (report.outcome === 'ALREADY') {
    log.info(`El sprint "${report.sprint.name}" (${report.sprint.id}) ya estaba activo.`);
    return;
  }

  if (report.outcome === 'DRY_RUN') {
    log.success(
      `Dry-run: se iniciaria "${report.sprint.name}" (${report.sprint.id}). No se cambio nada.`
    );
    return;
  }

  log.success(
    `Sprint iniciado: ${report.sprint.id} "${report.sprint.name}" (${report.sprint.state})`
  );
}
