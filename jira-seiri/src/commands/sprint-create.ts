import type { Command } from 'commander';
import { createSprint, type CreateSprintReport } from '../application/create-sprint';
import { closeDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { EXIT } from '../shared/exit-codes';
import { log } from '../shared/logger';
import { openProjectDatabase } from './project-db';
import { cachedProjectKey, createProjectGateway } from './project-gateway';
import { parseBoardId } from './sprint-options';

interface SprintCreateCommandOptions {
  name: string;
  start?: string;
  end?: string;
  board?: string;
  dryRun: boolean;
  json: boolean;
}

export function registerSprintCreateCommand(program: Command): void {
  program
    .command('sprint-create')
    .argument('<project>', 'nombre del proyecto (carpeta en projects/)')
    .description('Crea un sprint futuro en un board con sprints')
    .requiredOption('--name <name>', 'nombre del sprint')
    .option('--start <date>', 'fecha de inicio YYYY-MM-DD')
    .option('--end <date>', 'fecha de fin YYYY-MM-DD')
    .option('--board <id>', 'ID del board si hay mas de uno')
    .option('--dry-run', 'valida el board sin crear el sprint', false)
    .option('--json', 'salida JSON para agentes', false)
    .action(async (project: string, options: SprintCreateCommandOptions) => {
      const { db } = openProjectDatabase(project);

      try {
        const store = new SqliteIssueStore(db);
        const projectKey = cachedProjectKey(store, project);
        const gateway = createProjectGateway(project, projectKey);
        const boardId = parseBoardId(options.board);

        if (!options.json) {
          log.title(`sprint-create "${options.name}"${options.dryRun ? ' (dry-run)' : ''}`);
          log.info(`Proyecto "${project}" -> ${projectKey}`);
        }

        const report = await createSprint(gateway, projectKey, {
          name: options.name,
          boardId,
          startDate: options.start,
          endDate: options.end,
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
    });
}

function printReport(report: CreateSprintReport): void {
  log.info(`Board "${report.board.name}" (${report.board.id}) · ${report.board.type}`);

  if (report.dryRun) {
    log.success(
      `Dry-run: se crearia "${report.name}" (${formatDate(report.startDate)} -> ${formatDate(report.endDate)}). No se creo nada.`
    );
    return;
  }

  const sprint = report.sprint;
  if (!sprint) {
    log.warn('Jira no devolvio el sprint creado.');
    return;
  }

  log.success(
    `Sprint creado: ${sprint.id} "${sprint.name}" (${sprint.state}) ${formatDate(sprint.startDate)} -> ${formatDate(sprint.endDate)}`
  );
}

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10) : '-';
}
