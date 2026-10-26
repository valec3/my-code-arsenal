import type { Command } from 'commander';
import pc from 'picocolors';
import { closeDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { log } from '../shared/logger';
import { openProjectDatabase } from './project-db';
import { cachedProjectKey, createProjectGateway } from './project-gateway';

interface UsersCommandOptions {
  json: boolean;
}

export function registerUsersCommand(program: Command): void {
  program
    .command('users')
    .argument('<project>', 'nombre del proyecto (carpeta en projects/)')
    .description('Lista los usuarios asignables del proyecto')
    .option('--json', 'salida JSON para agentes', false)
    .action(async (project: string, options: UsersCommandOptions) => {
      const { db } = openProjectDatabase(project);

      try {
        const store = new SqliteIssueStore(db);
        const projectKey = cachedProjectKey(store, project);
        const gateway = createProjectGateway(project, projectKey);

        if (!options.json) {
          log.title(`users ${project} -> ${projectKey}`);
        }

        const users = await gateway.listAssignableUsers(projectKey);
        users.sort((left, right) => left.displayName.localeCompare(right.displayName));

        if (options.json) {
          console.log(JSON.stringify({ projectKey, users }, null, 2));
          return;
        }

        if (users.length === 0) {
          log.warn('No hay usuarios asignables. Revisa permisos de Browse users en Jira.');
          return;
        }

        for (const user of users) {
          const suffix = user.active ? '' : pc.dim(' (inactivo)');
          console.log(`${pc.bold(user.displayName)}${suffix}`);
          console.log(
            pc.dim(`        ${user.emailAddress ?? '(email oculto)'} · ${user.accountId}`)
          );
        }

        log.info(`${users.length} usuarios asignables.`);
      } finally {
        closeDatabase(db);
      }
    });
}
