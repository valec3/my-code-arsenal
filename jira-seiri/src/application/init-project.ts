import fs from 'node:fs';
import path from 'node:path';
import {
  TEMPLATE_PROJECT_DIR,
  projectDbPath,
  projectDir,
} from '../config/paths';
import {
  applySchema,
  closeDatabase,
  listTables,
  openDatabase,
  readSchemaVersion,
} from '../infrastructure/db/connection';

const ENV_EXAMPLE_FALLBACK = 'JIRA_PROJECT_KEY=ENG\n';

export interface InitProjectResult {
  project: string;
  dbPath: string;
  schemaVersion: number;
  tables: string[];
  createdEnvExample: boolean;
}

export function initProject(project: string): InitProjectResult {
  const dir = projectDir(project);
  fs.mkdirSync(dir, { recursive: true });

  const createdEnvExample = ensureEnvExample(dir);
  const dbPath = projectDbPath(project);
  const db = openDatabase(dbPath);

  try {
    applySchema(db);
    return {
      project,
      dbPath,
      schemaVersion: readSchemaVersion(db),
      tables: listTables(db),
      createdEnvExample,
    };
  } finally {
    closeDatabase(db);
  }
}

function ensureEnvExample(dir: string): boolean {
  const target = path.join(dir, '.env.example');
  if (fs.existsSync(target)) {
    return false;
  }

  const template = path.join(TEMPLATE_PROJECT_DIR, '.env.example');
  const content = fs.existsSync(template)
    ? fs.readFileSync(template, 'utf8')
    : ENV_EXAMPLE_FALLBACK;

  fs.writeFileSync(target, content, 'utf8');
  return true;
}
