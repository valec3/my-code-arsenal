import fs from 'node:fs';
import type { Command } from 'commander';
import { defaultJql, pullProject } from '../application/pull-project';
import { loadProjectEnv } from '../config/env';
import { projectContextPath, projectDbPath } from '../config/paths';
import { SeiriError } from '../domain/errors';
import { applySchema, closeDatabase, openDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { createJiraGateway } from '../infrastructure/jira/gateway';
import { log } from '../shared/logger';

interface PullCommandOptions {
  days: string;
  jql?: string;
  maxIssues: string;
}

export function registerPullCommand(program: Command): void {
  program
    .command('pull')
    .argument('<project>', 'nombre del proyecto (carpeta en projects/)')
    .description('Sincroniza Jira con la base local y genera .jira_context.md')
    .option('--days <n>', 'ventana de actualizacion en dias', '30')
    .option('--jql <query>', 'JQL explicito (ignora --days)')
    .option('--max-issues <n>', 'maximo de issues en el contexto', '150')
    .action(async (project: string, options: PullCommandOptions) => {
      const days = parsePositiveInt(options.days, '--days');
      const maxIssues = parsePositiveInt(options.maxIssues, '--max-issues');
      const env = loadProjectEnv(project);

      const gateway = createJiraGateway(
        { host: env.host, email: env.email, apiToken: env.apiToken },
        { storyPointsField: env.storyPointsField }
      );

      const db = openDatabase(projectDbPath(project));
      try {
        applySchema(db);
        const store = new SqliteIssueStore(db);
        const jql = options.jql?.trim() || defaultJql(env.projectKey, days);

        log.info(`Pull ${env.projectKey} · ${jql}`);
        const result = await pullProject(
          { gateway, store },
          {
            project,
            projectKey: env.projectKey,
            host: env.host,
            days,
            jql: options.jql,
            maxIssues,
            storyPointsField: env.storyPointsField,
          }
        );

        const contextPath = projectContextPath(project);
        fs.writeFileSync(contextPath, result.contextMarkdown, 'utf8');

        log.success(`Jira -> SQLite: ${result.fetched} issues (${result.local} en local)`);
        log.info(`Tipos de issue: ${result.issueTypes}`);
        log.success(`Contexto escrito: ${contextPath}`);
      } finally {
        closeDatabase(db);
      }
    });
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new SeiriError(`${flag} debe ser un entero positivo`, 'VALIDATION');
  }

  return parsed;
}
