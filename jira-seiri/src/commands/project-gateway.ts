import { loadProjectEnv } from '../config/env';
import { SeiriError } from '../domain/errors';
import { createJiraGateway } from '../infrastructure/jira/gateway';
import type { IssueStore } from '../ports/issue-store';
import type { JiraGateway } from '../ports/jira-gateway';

export function cachedProjectKey(store: IssueStore, project: string): string {
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

export function createProjectGateway(project: string, projectKey: string): JiraGateway {
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
