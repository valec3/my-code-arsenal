import { describe, expect, it } from 'vitest';
import { validateMigration } from '../../../src/application/validate-migration';
import type { Issue, IssueType } from '../../../src/domain/issue';
import type { MigrationFile, MigrationItem } from '../../../src/domain/migration';
import type { IssueStore, ProjectSnapshot, SimilarIssue } from '../../../src/ports/issue-store';

const TYPES: IssueType[] = [
  { id: '1', name: 'Epic', hierarchyLevel: 1, subtask: false },
  { id: '2', name: 'Story', hierarchyLevel: 0, subtask: false },
  { id: '3', name: 'Task', hierarchyLevel: 0, subtask: false },
  { id: '4', name: 'Sub-task', hierarchyLevel: -1, subtask: true },
];

interface FakeConfig {
  projects?: string[];
  types?: IssueType[];
  issues?: Issue[];
  similar?: SimilarIssue[];
}

class FakeStore implements IssueStore {
  private readonly config: Required<FakeConfig>;

  constructor(config: FakeConfig = {}) {
    this.config = {
      projects: config.projects ?? ['ENG'],
      types: config.types ?? TYPES,
      issues: config.issues ?? [],
      similar: config.similar ?? [],
    };
  }

  saveSnapshot(_snapshot: ProjectSnapshot): void {}

  listIssues(): Issue[] {
    return [...this.config.issues];
  }

  countIssues(): number {
    return this.config.issues.length;
  }

  getIssue(key: string): Issue | null {
    return this.config.issues.find((issue) => issue.key === key) ?? null;
  }

  listIssueTypes(): IssueType[] {
    return [...this.config.types];
  }

  searchSimilar(_projectKey: string, _text: string, limit = 10): SimilarIssue[] {
    return this.config.similar.slice(0, limit);
  }

  listProjectKeys(): string[] {
    return [...this.config.projects];
  }
}

function existingIssue(overrides: Partial<Issue> & { key: string }): Issue {
  return {
    projectKey: 'ENG',
    parentKey: null,
    summary: 'Issue existente',
    description: '',
    issueType: 'Story',
    hierarchyLevel: 0,
    status: 'To Do',
    priority: null,
    storyPoints: null,
    jiraCreatedAt: null,
    jiraUpdatedAt: null,
    ...overrides,
  };
}

function item(overrides: Partial<MigrationItem> & { local_ref: string }): MigrationItem {
  return {
    action: 'CREATE',
    type: 'Task',
    summary: 'Configurar reportes automaticos de citas',
    ...overrides,
  };
}

function migration(items: MigrationItem[]): MigrationFile {
  return { version: 1, project: 'endogastro', items };
}

const OPTIONS = { file: 'migrations/test.json' };

describe('validateMigration', () => {
  it('aprueba una migracion limpia', () => {
    const report = validateMigration(
      { store: new FakeStore() },
      migration([item({ local_ref: 'reports' })]),
      OPTIONS
    );

    expect(report.ok).toBe(true);
    expect(report.projectKey).toBe('ENG');
    expect(report.errors).toEqual([]);
    expect(report.duplicates).toEqual([]);
  });

  it('falla si la base no tiene proyectos sincronizados', () => {
    const report = validateMigration(
      { store: new FakeStore({ projects: [] }) },
      migration([item({ local_ref: 'reports' })]),
      OPTIONS
    );

    expect(report.projectKey).toBeNull();
    expect(report.errors[0].code).toBe('PROJECT');
  });

  it('reporta un tipo de issue desconocido con sugerencias', () => {
    const report = validateMigration(
      { store: new FakeStore() },
      migration([item({ local_ref: 'reports', type: 'Bug' })]),
      OPTIONS
    );

    expect(report.ok).toBe(false);
    expect(report.errors[0].code).toBe('UNKNOWN_TYPE');
    expect(report.errors[0].hint).toContain('Epic');
  });

  it('exige parent cuando el tipo es subtask', () => {
    const report = validateMigration(
      { store: new FakeStore() },
      migration([item({ local_ref: 'reports', type: 'Sub-task' })]),
      OPTIONS
    );

    expect(report.errors[0].code).toBe('HIERARCHY');
    expect(report.errors[0].message).toContain('necesita parent');
  });

  it('rechaza una Task colgada de una Story existente', () => {
    const store = new FakeStore({
      issues: [existingIssue({ key: 'ENG-222', issueType: 'Story', hierarchyLevel: 0 })],
    });

    const report = validateMigration(
      { store },
      migration([item({ local_ref: 'reports', parent: 'ENG-222' })]),
      OPTIONS
    );

    expect(report.errors[0].code).toBe('HIERARCHY');
    expect(report.errors[0].message).toContain('nivel mayor');
  });

  it('acepta una cadena Epic -> Story -> Sub-task por local_ref', () => {
    const report = validateMigration(
      { store: new FakeStore() },
      migration([
        item({ local_ref: 'epic', type: 'Epic', summary: 'EPICA: reportes' }),
        item({ local_ref: 'story', type: 'Story', parent: 'epic', summary: 'HU: reportes' }),
        item({ local_ref: 'sub', type: 'Sub-task', parent: 'story', summary: 'BACK: reportes' }),
      ]),
      OPTIONS
    );

    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('detecta un ciclo de padres', () => {
    const report = validateMigration(
      { store: new FakeStore() },
      migration([
        item({ local_ref: 'a', type: 'Story', parent: 'b', summary: 'A' }),
        item({ local_ref: 'b', type: 'Story', parent: 'a', summary: 'B' }),
      ]),
      OPTIONS
    );

    expect(report.errors.some((error) => error.code === 'CYCLE')).toBe(true);
  });

  it('reporta un parent que no existe en el cache', () => {
    const report = validateMigration(
      { store: new FakeStore() },
      migration([item({ local_ref: 'reports', parent: 'ENG-999' })]),
      OPTIONS
    );

    expect(report.errors[0].code).toBe('PARENT');
    expect(report.errors[0].message).toContain('ENG-999');
  });

  it('marca duplicados contra issues existentes', () => {
    const store = new FakeStore({
      similar: [
        {
          key: 'ENG-226',
          summary: 'Configurar reportes automaticos de citas',
          status: 'In Progress',
        },
      ],
    });

    const report = validateMigration(
      { store },
      migration([item({ local_ref: 'reports' })]),
      OPTIONS
    );

    expect(report.ok).toBe(false);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0]).toMatchObject({
      ref: 'reports',
      key: 'ENG-226',
      source: 'existing',
      score: 100,
    });
  });

  it('marca duplicados dentro del mismo archivo', () => {
    const report = validateMigration(
      { store: new FakeStore() },
      migration([
        item({ local_ref: 'reports-a' }),
        item({ local_ref: 'reports-b' }),
      ]),
      OPTIONS
    );

    expect(report.duplicates[0]).toMatchObject({
      ref: 'reports-a',
      otherRef: 'reports-b',
      source: 'in_file',
    });
  });

  it('respeta el umbral configurado', () => {
    const store = new FakeStore({
      similar: [
        {
          key: 'ENG-226',
          summary: 'Configurar reportes automaticos de citas diarias',
          status: 'To Do',
        },
      ],
    });

    const strict = validateMigration(
      { store },
      migration([item({ local_ref: 'reports' })]),
      { ...OPTIONS, threshold: 100 }
    );

    expect(strict.duplicates).toEqual([]);
  });
});
