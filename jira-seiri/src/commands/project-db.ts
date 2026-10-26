import fs from 'node:fs';
import { projectDbPath } from '../config/paths';
import { SeiriError } from '../domain/errors';
import {
  applySchema,
  closeDatabase,
  listTables,
  openDatabase,
  type Db,
} from '../infrastructure/db/connection';

export interface ProjectDatabase {
  db: Db;
  path: string;
}

export function openProjectDatabase(project: string): ProjectDatabase {
  const dbPath = projectDbPath(project);

  if (!fs.existsSync(dbPath)) {
    throw new SeiriError(
      `No existe la base local del proyecto "${project}".`,
      'CONFIG',
      `Corre seiri init ${project} y despues seiri pull ${project}.`
    );
  }

  const db = openDatabase(dbPath);

  try {
    const tables = listTables(db);
    if (!tables.includes('issues') || !tables.includes('issue_types')) {
      throw new SeiriError(
        `La base de "${project}" no tiene el esquema de seiri.`,
        'CONFIG',
        `Corre seiri pull ${project} para inicializarla.`
      );
    }

    applySchema(db);
    return { db, path: dbPath };
  } catch (error) {
    closeDatabase(db);
    throw error;
  }
}
