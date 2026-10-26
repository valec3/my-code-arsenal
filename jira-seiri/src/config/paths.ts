import path from 'node:path';
import { SeiriError } from '../domain/errors';

export const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
export const SCHEMA_PATH = path.join(PACKAGE_ROOT, 'schema.sql');
export const PROJECTS_DIR = path.join(PACKAGE_ROOT, 'projects');
export const MIGRATIONS_DIR = path.join(PACKAGE_ROOT, 'migrations');
export const TEMPLATE_PROJECT_DIR = path.join(PROJECTS_DIR, '_template');

const PROJECT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export function assertProjectName(project: string): void {
  if (!PROJECT_NAME_PATTERN.test(project)) {
    throw new SeiriError(
      `Nombre de proyecto invalido: "${project}"`,
      'INVALID_PROJECT',
      'Usa kebab-case: minusculas, numeros y guiones. Ejemplo: endogastro'
    );
  }
}

export function projectDir(project: string): string {
  assertProjectName(project);
  return path.join(PROJECTS_DIR, project);
}

export function projectDbPath(project: string): string {
  return path.join(projectDir(project), '.jira_cache.db');
}

export function projectContextPath(project: string): string {
  return path.join(projectDir(project), '.jira_context.md');
}
