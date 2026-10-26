import type { Command } from 'commander';
import pc from 'picocolors';
import { listProjectSprints, type SprintListReport } from '../application/list-sprints';
import { closeDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { EXIT } from '../shared/exit-codes';
import { log } from '../shared/logger';
import { openProjectDatabase } from './project-db';
import { cachedProjectKey, createProjectGateway } from './project-gateway';
import { parseBoardId, parseSprintStates } from './sprint-options';

interface SprintsCommandOptions {
  board?: string;
  state: string;
  json: boolean;
}

export function registerSprintsCommand(program: Command): void {
  program
    .command('sprints')
    .argument('<project>', 'nombre del proyecto (carpeta en projects/)')
    .description('Lista los boards con sprints y sus sprints')
    .option('--board <id>', 'ID del board si hay mas de uno')
    .option('--state <states>', 'estados separados por coma', 'active,future,closed')
    .option('--json', 'salida JSON para agentes', false)
    .action(async (project: string, options: SprintsCommandOptions) => {
      const { db } = openProjectDatabase(project);

      try {
        const store = new SqliteIssueStore(db);
        const projectKey = cachedProjectKey(store, project);
        const gateway = createProjectGateway(project, projectKey);
        const boardId = parseBoardId(options.board);
        const states = parseSprintStates(options.state);

        if (!options.json) {
          log.title(`sprints ${project} -> ${projectKey}`);
        }

        const report = await listProjectSprints(gateway, projectKey, { boardId, states });

        if (options.json) {
          console.log(
            JSON.stringify({ ...report, states, exitCode: EXIT.OK }, null, 2)
          );
          return;
        }

        log.info(`Board "${report.board.name}" (${report.board.id}) · ${report.board.type}`);
        printSprints(report);
      } finally {
        closeDatabase(db);
      }
    });
}

function printSprints(report: SprintListReport): void {
  if (report.sprints.length === 0) {
    log.warn('No hay sprints en el board. Crealos desde Jira o cambia --state.');
    return;
  }

  console.log(
    [
      pc.bold('ID'.padEnd(7)),
      pc.bold('Estado'.padEnd(8)),
      pc.bold('Inicio'.padEnd(12)),
      pc.bold('Fin'.padEnd(12)),
      pc.bold('Nombre'),
    ].join(' ')
  );

  for (const sprint of report.sprints) {
    console.log(
      [
        String(sprint.id).padEnd(7),
        sprint.state.padEnd(8),
        formatDate(sprint.startDate).padEnd(12),
        formatDate(sprint.endDate).padEnd(12),
        sprint.name,
      ].join(' ')
    );
  }

  log.info(`${report.sprints.length} sprints.`);
}

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10) : '-';
}
