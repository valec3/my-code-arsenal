import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { SeiriError } from '../domain/errors';
import { PACKAGE_ROOT, projectDir } from './paths';

export interface ProjectEnv {
  host: string;
  email: string;
  apiToken: string;
  projectKey: string;
  storyPointsField?: string;
}

const REQUIRED = ['JIRA_HOST', 'JIRA_USER_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'] as const;

export function loadProjectEnv(project: string): ProjectEnv {
  const rootEnvPath = path.join(PACKAGE_ROOT, '.env');
  if (!fs.existsSync(rootEnvPath)) {
    throw new SeiriError(
      'Falta el .env raiz de jira-seiri',
      'CONFIG',
      'Copia .env.example a .env y completa JIRA_HOST, JIRA_USER_EMAIL y JIRA_API_TOKEN.'
    );
  }
  dotenv.config({ path: rootEnvPath });

  const envPath = path.join(projectDir(project), '.env');
  if (!fs.existsSync(envPath)) {
    throw new SeiriError(
      `Falta projects/${project}/.env`,
      'CONFIG',
      `Copia projects/${project}/.env.example a .env y completa JIRA_PROJECT_KEY.`
    );
  }
  dotenv.config({ path: envPath, override: true });

  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new SeiriError(
      `Faltan variables de entorno: ${missing.join(', ')}`,
      'CONFIG',
      'Revisa el .env raiz y el .env del proyecto.'
    );
  }

  const host = process.env.JIRA_HOST!.trim().replace(/\/+$/, '');
  assertHttpsUrl(host);

  const email = process.env.JIRA_USER_EMAIL!.trim();
  const apiToken = process.env.JIRA_API_TOKEN!.trim();
  const projectKey = process.env.JIRA_PROJECT_KEY!.trim();

  const placeholders = [
    host.includes('your-domain') ? 'JIRA_HOST' : null,
    email === 'you@example.com' ? 'JIRA_USER_EMAIL' : null,
    apiToken === 'your_api_token_here' ? 'JIRA_API_TOKEN' : null,
    projectKey === 'YOUR_PROJECT_KEY' ? 'JIRA_PROJECT_KEY' : null,
  ].filter((value): value is string => value !== null);

  if (placeholders.length > 0) {
    throw new SeiriError(
      `Todavia hay valores de ejemplo en: ${placeholders.join(', ')}`,
      'CONFIG',
      'Edita jira-seiri/.env y projects/<proyecto>/.env con tus datos reales.'
    );
  }

  return {
    host,
    email,
    apiToken,
    projectKey,
    storyPointsField: process.env.JIRA_STORY_POINTS_FIELD?.trim() || undefined,
  };
}

function assertHttpsUrl(value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') {
      return;
    }
  } catch {
    // cae al error de abajo
  }

  throw new SeiriError(
    `JIRA_HOST invalido: "${value}"`,
    'CONFIG',
    'Debe ser una URL https, por ejemplo https://tu-sitio.atlassian.net'
  );
}
