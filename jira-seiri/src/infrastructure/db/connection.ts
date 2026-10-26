import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SCHEMA_PATH } from '../../config/paths';
import { SeiriError } from '../../domain/errors';

export type Db = Database.Database;

export function openDatabase(dbPath: string): Db {
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    return db;
  } catch (error) {
    throw new SeiriError(
      `No se pudo abrir la base local: ${messageOf(error)}`,
      'DB',
      dbPath
    );
  }
}

export function applySchema(db: Db): void {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new SeiriError('No se encontro schema.sql', 'SCHEMA', SCHEMA_PATH);
  }

  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  try {
    db.exec(sql);
  } catch (error) {
    throw new SeiriError(
      `Fallo al aplicar el esquema: ${messageOf(error)}`,
      'SCHEMA'
    );
  }
}

export function listTables(db: Db): string[] {
  const rows = db
    .prepare(
      `SELECT name
         FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE 'issues_fts_%'
        ORDER BY name`
    )
    .all() as Array<{ name: string }>;

  return rows.map((row) => row.name);
}

export function readSchemaVersion(db: Db): number {
  const row = db
    .prepare('SELECT MAX(version) AS version FROM schema_version')
    .get() as { version: number | null };

  return row.version ?? 0;
}

export function closeDatabase(db: Db): void {
  db.close();
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
