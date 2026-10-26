import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Issue } from '../../../src/domain/issue';
import {
  applySchema,
  closeDatabase,
  openDatabase,
  type Db,
} from '../../../src/infrastructure/db/connection';
import {
  buildFtsQuery,
  SqliteIssueStore,
} from '../../../src/infrastructure/db/issue-store';

let dir: string;
let db: Db;
let store: SqliteIssueStore;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seiri-db-'));
  db = openDatabase(path.join(dir, 'cache.db'));
  applySchema(db);
  store = new SqliteIssueStore(db);
});

afterEach(() => {
  closeDatabase(db);
  fs.rmSync(dir, { recursive: true, force: true });
});

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    key: 'ENG-1',
    projectKey: 'ENG',
    parentKey: null,
    summary: 'Epic base',
    description: 'desc',
    issueType: 'Epic',
    hierarchyLevel: 1,
    status: 'To Do',
    priority: 'High',
    storyPoints: null,
    jiraCreatedAt: '2026-01-01T00:00:00.000+0000',
    jiraUpdatedAt: '2026-01-02T00:00:00.000+0000',
    ...overrides,
  };
}

const PROJECT = { key: 'ENG', name: 'Engineering' };
const TYPES = [
  { id: '1', name: 'Epic', hierarchyLevel: 1, subtask: false },
  { id: '2', name: 'Story', hierarchyLevel: 0, subtask: false },
  { id: '3', name: 'Sub-task', hierarchyLevel: -1, subtask: true },
];

describe('SqliteIssueStore', () => {
  it('guarda y lee un snapshot mapeado', () => {
    store.saveSnapshot({
      project: PROJECT,
      issueTypes: TYPES,
      issues: [
        issue(),
        issue({
          key: 'ENG-2',
          parentKey: 'ENG-1',
          summary: 'Hija',
          issueType: 'Task',
          hierarchyLevel: 0,
          jiraUpdatedAt: '2026-01-03T00:00:00.000+0000',
        }),
      ],
    });

    const issues = store.listIssues('ENG');

    expect(issues.map((item) => item.key)).toEqual(['ENG-2', 'ENG-1']);
    expect(issues[0]).toMatchObject({
      parentKey: 'ENG-1',
      projectKey: 'ENG',
      issueType: 'Task',
      summary: 'Hija',
    });
    expect(store.countIssues('ENG')).toBe(2);
  });

  it('es idempotente entre snapshots', () => {
    const snapshot = { project: PROJECT, issueTypes: TYPES, issues: [issue()] };

    store.saveSnapshot(snapshot);
    store.saveSnapshot(snapshot);

    expect(store.countIssues('ENG')).toBe(1);
  });

  it('actualiza el summary y mantiene el indice FTS', () => {
    store.saveSnapshot({ project: PROJECT, issueTypes: TYPES, issues: [issue({ summary: 'Marco legal' })] });
    store.saveSnapshot({
      project: PROJECT,
      issueTypes: TYPES,
      issues: [issue({ summary: 'Marco legal actualizado' })],
    });

    const rows = db
      .prepare("SELECT key FROM issues_fts WHERE issues_fts MATCH 'actualizado'")
      .all();

    expect(rows).toEqual([{ key: 'ENG-1' }]);
    expect(store.listIssues('ENG')[0].summary).toBe('Marco legal actualizado');
  });

  it('reemplaza los tipos de issue del proyecto', () => {
    const base = { project: PROJECT, issues: [] };

    store.saveSnapshot({
      ...base,
      issueTypes: [
        { id: '1', name: 'Epic', hierarchyLevel: 1, subtask: false },
        { id: '2', name: 'Task', hierarchyLevel: 0, subtask: false },
      ],
    });
    store.saveSnapshot({
      ...base,
      issueTypes: [{ id: '2', name: 'Task', hierarchyLevel: 0, subtask: false }],
    });

    const row = db
      .prepare('SELECT COUNT(*) AS count FROM issue_types WHERE project_key = ?')
      .get('ENG') as { count: number };

    expect(row.count).toBe(1);
  });

  it('lee una issue por key y devuelve null si no existe', () => {
    store.saveSnapshot({ project: PROJECT, issueTypes: TYPES, issues: [issue()] });

    expect(store.getIssue('ENG-1')?.summary).toBe('Epic base');
    expect(store.getIssue('ENG-404')).toBeNull();
  });

  it('mapea los tipos de issue con subtask y nivel', () => {
    store.saveSnapshot({ project: PROJECT, issueTypes: TYPES, issues: [] });

    expect(store.listIssueTypes('ENG')).toEqual([
      { id: '1', name: 'Epic', hierarchyLevel: 1, subtask: false },
      { id: '2', name: 'Story', hierarchyLevel: 0, subtask: false },
      { id: '3', name: 'Sub-task', hierarchyLevel: -1, subtask: true },
    ]);
  });

  it('busca candidatos por FTS sin importar acentos', () => {
    store.saveSnapshot({
      project: PROJECT,
      issueTypes: TYPES,
      issues: [
        issue({ key: 'ENG-1', summary: 'Redacción preliminar de cláusulas' }),
        issue({ key: 'ENG-2', summary: 'Configurar webhook de reportes' }),
      ],
    });

    const found = store.searchSimilar('ENG', 'redaccion clausulas');

    expect(found.map((row) => row.key)).toContain('ENG-1');
    expect(found.map((row) => row.key)).not.toContain('ENG-2');
  });

  it('limita la busqueda al proyecto pedido', () => {
    store.saveSnapshot({
      project: PROJECT,
      issueTypes: TYPES,
      issues: [issue({ key: 'ENG-1', summary: 'Webhook de reportes' })],
    });
    store.saveSnapshot({
      project: { key: 'OTH', name: 'Other' },
      issueTypes: [],
      issues: [issue({ key: 'OTH-1', projectKey: 'OTH', summary: 'Webhook de reportes' })],
    });

    const found = store.searchSimilar('ENG', 'webhook reportes');

    expect(found.map((row) => row.key)).toEqual(['ENG-1']);
  });

  it('devuelve vacio cuando el texto no tiene tokens utiles', () => {
    store.saveSnapshot({ project: PROJECT, issueTypes: TYPES, issues: [issue()] });

    expect(store.searchSimilar('ENG', 'a b c')).toEqual([]);
    expect(buildFtsQuery('" OR * --')).toBe('');
  });

  it('sanea la query FTS y arma prefijos con OR', () => {
    expect(buildFtsQuery('Marco Legal, Ley 29733')).toBe('marco* OR legal* OR ley* OR 29733*');
  });
});
