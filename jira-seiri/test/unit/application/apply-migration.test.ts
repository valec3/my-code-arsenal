import { describe, expect, it } from 'vitest';
import { applyMigration } from '../../../src/application/apply-migration';
import { SeiriError } from '../../../src/domain/errors';
import type { CreateIssueInput, Issue, IssueType } from '../../../src/domain/issue';
import type { MigrationFile, MigrationItem } from '../../../src/domain/migration';
import type { IssueStore, ProjectSnapshot, SimilarIssue } from '../../../src/ports/issue-store';
import type { JiraGateway } from '../../../src/ports/jira-gateway';
import type {
  MigrationItemRecord,
  MigrationRecord,
  MigrationStatus,
  MigrationStore,
  NewMigration,
  NewMigrationItem,
} from '../../../src/ports/migration-store';

const TYPES: IssueType[] = [
  { id: '1', name: 'Epic', hierarchyLevel: 1, subtask: false },
  { id: '2', name: 'Story', hierarchyLevel: 0, subtask: false },
  { id: '3', name: 'Sub-task', hierarchyLevel: -1, subtask: true },
];

class FakeStore implements IssueStore {
  issues: Issue[] = [];
  types: IssueType[] = TYPES;
  projects: string[] = ['ENG'];
  similar: SimilarIssue[] = [];

  saveSnapshot(_snapshot: ProjectSnapshot): void {}

  listIssues(): Issue[] {
    return [...this.issues];
  }

  countIssues(): number {
    return this.issues.length;
  }

  upsertIssue(issue: Issue): void {
    const index = this.issues.findIndex((candidate) => candidate.key === issue.key);
    if (index >= 0) {
      this.issues[index] = issue;
    } else {
      this.issues.push(issue);
    }
  }

  getIssue(key: string): Issue | null {
    return this.issues.find((issue) => issue.key === key) ?? null;
  }

  listIssueTypes(): IssueType[] {
    return [...this.types];
  }

  searchSimilar(_projectKey: string, _text: string, limit = 10): SimilarIssue[] {
    const indexed = this.issues.map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
    }));

    return [...indexed, ...this.similar].slice(0, limit);
  }

  listProjectKeys(): string[] {
    return [...this.projects];
  }
}

class FakeMigrations implements MigrationStore {
  private readonly records = new Map<string, MigrationRecord>();
  private readonly items = new Map<string, NewMigrationItem[]>();

  get(filename: string): MigrationRecord | null {
    const record = this.records.get(filename);
    return record ? { ...record } : null;
  }

  save(migration: NewMigration): void {
    this.records.set(migration.filename, { ...migration, appliedAt: null });
  }

  setStatus(filename: string, status: MigrationStatus): void {
    const record = this.records.get(filename);
    if (record) {
      record.status = status;
      if (status === 'SUCCESS') {
        record.appliedAt = '2026-01-01T00:00:00.000Z';
      }
    }
  }

  listItems(filename: string): MigrationItemRecord[] {
    return (this.items.get(filename) ?? [])
      .map((item) => ({
        operationIndex: item.operationIndex,
        localRef: item.localRef,
        action: item.action,
        issueType: item.issueType,
        parentKey: item.parentKey,
        summary: item.summary,
        status: item.status,
        issueKey: item.issueKey ?? null,
        error: item.error ?? null,
      }))
      .sort((left, right) => left.operationIndex - right.operationIndex);
  }

  saveItem(item: NewMigrationItem): void {
    const list = this.items.get(item.filename) ?? [];
    const index = list.findIndex((entry) => entry.operationIndex === item.operationIndex);
    if (index >= 0) {
      list[index] = { ...item };
    } else {
      list.push({ ...item });
    }
    this.items.set(item.filename, list);
  }
}

class FakeGateway implements JiraGateway {
  calls: CreateIssueInput[] = [];
  createdKeys: string[] = [];
  failOnCall = -1;
  private readonly byKey = new Map<string, CreateIssueInput>();

  async createIssue(input: CreateIssueInput): Promise<{ key: string; id: string }> {
    this.calls.push(input);

    if (this.calls.length === this.failOnCall) {
      this.failOnCall = -1;
      throw new Error('Jira exploto');
    }

    const key = `ENG-${100 + this.createdKeys.length + 1}`;
    this.createdKeys.push(key);
    this.byKey.set(key, input);
    return { key, id: key };
  }

  async getIssue(key: string): Promise<Issue> {
    const input = this.byKey.get(key);
    return {
      key,
      projectKey: 'ENG',
      parentKey: input?.parentKey ?? null,
      summary: input?.summary ?? 'Creada',
      description: input?.description ?? '',
      issueType: input?.issueType ?? 'Task',
      hierarchyLevel: 0,
      status: 'To Do',
      priority: input?.priority ?? null,
      storyPoints: input?.storyPoints ?? null,
      jiraCreatedAt: '2026-01-01T00:00:00.000+0000',
      jiraUpdatedAt: '2026-01-01T00:00:00.000+0000',
    };
  }

  async getMyself(): Promise<{ displayName: string; emailAddress: string }> {
    return { displayName: 'Ana', emailAddress: 'ana@acme.com' };
  }

  async getProject(): Promise<{ key: string; name: string }> {
    return { key: 'ENG', name: 'Engineering' };
  }

  async searchIssues(): Promise<Issue[]> {
    return [];
  }

  async getIssueTypes(): Promise<IssueType[]> {
    return TYPES;
  }

  async getFields() {
    return [];
  }

  async deleteIssue(): Promise<void> {}
}

function item(overrides: Partial<MigrationItem> & { local_ref: string }): MigrationItem {
  return {
    action: 'CREATE',
    type: 'Story',
    summary: 'HU: reportes de citas',
    ...overrides,
  };
}

const MIGRATION: MigrationFile = {
  version: 1,
  project: 'endogastro',
  description: 'Reportes',
  items: [
    item({ local_ref: 'epic', type: 'Epic', summary: 'EPICA: reportes' }),
    item({ local_ref: 'story', parent: 'epic', summary: 'HU: reportes de citas' }),
  ],
};

const OPTIONS = {
  file: 'C:\\repo\\migrations\\2026-10-24_reportes.json',
  projectKey: 'ENG',
  checksum: 'checksum-v1',
  dryRun: false,
  allowDuplicates: false,
};

function deps() {
  const store = new FakeStore();
  const migrations = new FakeMigrations();
  const gateway = new FakeGateway();

  return {
    store,
    migrations,
    gateway,
    createGateway: () => gateway,
  };
}

describe('applyMigration', () => {
  it('en dry-run arma el plan sin red ni escrituras', async () => {
    const fake = deps();

    const result = await applyMigration(fake, MIGRATION, { ...OPTIONS, dryRun: true });

    expect(result.status).toBe('DRY_RUN');
    expect(result.plan.map((entry) => entry.localRef)).toEqual(['epic', 'story']);
    expect(fake.gateway.calls).toEqual([]);
    expect(fake.migrations.get('2026-10-24_reportes.json')).toBeNull();
  });

  it('crea en orden de jerarquia y resuelve el parent local', async () => {
    const fake = deps();

    const result = await applyMigration(fake, MIGRATION, OPTIONS);

    expect(result.status).toBe('SUCCESS');
    expect(result.created).toEqual([
      { localRef: 'epic', issueKey: 'ENG-101' },
      { localRef: 'story', issueKey: 'ENG-102' },
    ]);
    expect(fake.gateway.calls[0].parentKey).toBeUndefined();
    expect(fake.gateway.calls[1].parentKey).toBe('ENG-101');
    expect(fake.store.issues.map((issue) => issue.key)).toEqual(['ENG-101', 'ENG-102']);
    expect(fake.migrations.get('2026-10-24_reportes.json')).toMatchObject({
      status: 'SUCCESS',
      checksum: 'checksum-v1',
    });
  });

  it('es idempotente: una segunda corrida no crea nada', async () => {
    const fake = deps();
    await applyMigration(fake, MIGRATION, OPTIONS);
    const callsBefore = fake.gateway.calls.length;

    const second = await applyMigration(fake, MIGRATION, OPTIONS);

    expect(second.status).toBe('SKIPPED');
    expect(fake.gateway.calls).toHaveLength(callsBefore);
  });

  it('rechaza una migracion editada despues de aplicada', async () => {
    const fake = deps();
    await applyMigration(fake, MIGRATION, OPTIONS);

    await expect(
      applyMigration(fake, MIGRATION, { ...OPTIONS, checksum: 'otro' })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('marca PARTIAL y retoma desde el item fallido', async () => {
    const fake = deps();
    fake.gateway.failOnCall = 2;

    const partial = await applyMigration(fake, MIGRATION, OPTIONS);

    expect(partial.status).toBe('PARTIAL');
    expect(partial.created).toEqual([{ localRef: 'epic', issueKey: 'ENG-101' }]);
    expect(partial.failures[0].localRef).toBe('story');
    expect(fake.migrations.get('2026-10-24_reportes.json')?.status).toBe('PARTIAL');

    fake.store.similar = [
      { key: 'ENG-101', summary: 'HU: reportes de citas', status: 'To Do' },
    ];

    const resumed = await applyMigration(fake, MIGRATION, OPTIONS);

    expect(resumed.status).toBe('SUCCESS');
    expect(resumed.skipped).toEqual(['epic']);
    expect(resumed.created).toEqual([{ localRef: 'story', issueKey: 'ENG-102' }]);
    expect(fake.gateway.calls[2].parentKey).toBe('ENG-101');
    expect(fake.migrations.get('2026-10-24_reportes.json')?.status).toBe('SUCCESS');
  });

  it('frena ante duplicados salvo con allowDuplicates', async () => {
    const fake = deps();
    fake.store.similar = [
      { key: 'ENG-900', summary: MIGRATION.items[0].summary, status: 'To Do' },
    ];

    await expect(applyMigration(fake, MIGRATION, OPTIONS)).rejects.toMatchObject({
      code: 'DUPLICATE',
    });
    expect(fake.gateway.calls).toEqual([]);

    const result = await applyMigration(fake, MIGRATION, {
      ...OPTIONS,
      allowDuplicates: true,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.duplicates).toHaveLength(1);
  });

  it('no aplica si validate encontro errores de contrato', async () => {
    const fake = deps();
    const broken: MigrationFile = {
      ...MIGRATION,
      items: [item({ local_ref: 'bug', type: 'Bug' })],
    };

    await expect(applyMigration(fake, broken, OPTIONS)).rejects.toBeInstanceOf(SeiriError);
    expect(fake.gateway.calls).toEqual([]);
  });
});
