import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applySchema,
  closeDatabase,
  openDatabase,
  type Db,
} from '../../../src/infrastructure/db/connection';
import { SqliteMigrationStore } from '../../../src/infrastructure/db/migration-store';

let dir: string;
let db: Db;
let store: SqliteMigrationStore;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seiri-migrations-'));
  db = openDatabase(path.join(dir, 'cache.db'));
  applySchema(db);
  store = new SqliteMigrationStore(db);
});

afterEach(() => {
  closeDatabase(db);
  fs.rmSync(dir, { recursive: true, force: true });
});

const MIGRATION = {
  filename: '2026-10-24_reportes.json',
  description: 'Reportes',
  version: 1,
  checksum: 'abc123',
  status: 'PENDING' as const,
};

function item(overrides: Partial<Parameters<SqliteMigrationStore['saveItem']>[0]> = {}) {
  return {
    filename: MIGRATION.filename,
    operationIndex: 0,
    localRef: 'reports',
    action: 'CREATE',
    issueType: 'Task',
    parentKey: null,
    summary: 'Configurar reportes',
    status: 'PENDING' as const,
    ...overrides,
  };
}

describe('SqliteMigrationStore', () => {
  it('guarda y lee la cabecera de la migracion', () => {
    expect(store.get(MIGRATION.filename)).toBeNull();

    store.save(MIGRATION);

    expect(store.get(MIGRATION.filename)).toMatchObject({
      filename: MIGRATION.filename,
      checksum: 'abc123',
      status: 'PENDING',
      appliedAt: null,
    });
  });

  it('marca SUCCESS y sella applied_at', () => {
    store.save(MIGRATION);
    store.setStatus(MIGRATION.filename, 'SUCCESS');

    const record = store.get(MIGRATION.filename);

    expect(record?.status).toBe('SUCCESS');
    expect(record?.appliedAt).toBeTruthy();
  });

  it('hace upsert de items por operation_index', () => {
    store.save(MIGRATION);
    store.saveItem(item());
    store.saveItem(item({ status: 'CREATED', issueKey: 'ENG-227', error: null }));
    store.saveItem(item({ operationIndex: 1, localRef: 'otro', summary: 'Otra', status: 'FAILED', error: 'boom' }));

    const items = store.listItems(MIGRATION.filename);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      operationIndex: 0,
      status: 'CREATED',
      issueKey: 'ENG-227',
    });
    expect(items[1]).toMatchObject({ operationIndex: 1, status: 'FAILED', error: 'boom' });
  });
});
