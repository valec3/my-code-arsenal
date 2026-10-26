import { describe, expect, it } from 'vitest';
import { transitionIssues } from '../../../src/application/transition-issues';
import { SeiriError } from '../../../src/domain/errors';
import type { Issue, IssueType } from '../../../src/domain/issue';
import type { IssueTransition } from '../../../src/domain/transition';
import type {
  IssueStore,
  ProjectSnapshot,
  SimilarIssue,
} from '../../../src/ports/issue-store';
import type { JiraGateway } from '../../../src/ports/jira-gateway';

const TYPES: IssueType[] = [{ id: '1', name: 'Task', hierarchyLevel: 0, subtask: false }];

class FakeStore implements IssueStore {
  private readonly issues = new Map<string, Issue>();

  seed(issue: Issue): void {
    this.issues.set(issue.key, issue);
  }

  saveSnapshot(_snapshot: ProjectSnapshot): void {}

  listIssues(): Issue[] {
    return [...this.issues.values()];
  }

  countIssues(): number {
    return this.issues.size;
  }

  upsertIssue(issue: Issue): void {
    this.issues.set(issue.key, issue);
  }

  getIssue(key: string): Issue | null {
    return this.issues.get(key) ?? null;
  }

  listIssueTypes(): IssueType[] {
    return [...TYPES];
  }

  searchSimilar(_projectKey: string, _text: string, _limit = 10): SimilarIssue[] {
    return [];
  }

  listProjectKeys(): string[] {
    return ['ENG'];
  }
}

class FakeGateway {
  readonly issues = new Map<string, Issue>();
  readonly posted: Array<{ key: string; transitionId: string }> = [];
  transitions: IssueTransition[] = [];

  seed(issue: Issue): void {
    this.issues.set(issue.key, issue);
  }

  async getIssue(key: string): Promise<Issue> {
    const issue = this.issues.get(key);
    if (!issue) {
      throw new SeiriError(`No existe la issue ${key}`, 'JIRA');
    }
    return { ...issue };
  }

  async getTransitions(_issueKey: string): Promise<IssueTransition[]> {
    return [...this.transitions];
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    const transition = this.transitions.find((candidate) => candidate.id === transitionId);
    if (!transition) {
      throw new SeiriError(`Transicion ${transitionId} invalida`, 'JIRA');
    }
    const issue = this.issues.get(issueKey);
    if (!issue) {
      throw new SeiriError(`No existe la issue ${issueKey}`, 'JIRA');
    }
    this.posted.push({ key: issueKey, transitionId });
    this.issues.set(issueKey, { ...issue, status: transition.to });
  }
}

function issue(key: string, status = 'To Do'): Issue {
  return {
    key,
    projectKey: 'ENG',
    parentKey: null,
    summary: `Issue ${key}`,
    description: '',
    issueType: 'Task',
    hierarchyLevel: 0,
    status,
    priority: null,
    storyPoints: null,
    jiraCreatedAt: null,
    jiraUpdatedAt: null,
  };
}

function deps() {
  const store = new FakeStore();
  const gateway = new FakeGateway();

  return { store, gateway, deps: { store, gateway: gateway as unknown as JiraGateway } };
}

const DONE: IssueTransition[] = [{ id: '31', name: 'Done', to: 'Done' }];

describe('transitionIssues', () => {
  it('transiciona y refresca el cache local', async () => {
    const fake = deps();
    fake.gateway.seed(issue('ENG-1'));
    fake.gateway.transitions = DONE;

    const report = await transitionIssues(fake.deps, ['ENG-1'], {
      targetStatus: 'Done',
      dryRun: false,
    });

    expect(report.ok).toBe(true);
    expect(report.results[0]).toMatchObject({
      key: 'ENG-1',
      from: 'To Do',
      to: 'Done',
      outcome: 'TRANSITIONED',
      transition: { id: '31', name: 'Done' },
    });
    expect(fake.gateway.posted).toEqual([{ key: 'ENG-1', transitionId: '31' }]);
    expect(fake.store.getIssue('ENG-1')?.status).toBe('Done');
  });

  it('no repite si la issue ya esta en el estado destino', async () => {
    const fake = deps();
    fake.gateway.seed(issue('ENG-1', 'Done'));
    fake.gateway.transitions = DONE;

    const report = await transitionIssues(fake.deps, ['ENG-1'], {
      targetStatus: 'done',
      dryRun: false,
    });

    expect(report.results[0].outcome).toBe('ALREADY');
    expect(fake.gateway.posted).toEqual([]);
    expect(fake.store.getIssue('ENG-1')).toBeNull();
  });

  it('en dry-run muestra la transicion sin escribir', async () => {
    const fake = deps();
    fake.gateway.seed(issue('ENG-1'));
    fake.gateway.transitions = [
      { id: '31', name: 'Done', to: 'Done' },
      { id: '21', name: 'Empezar', to: 'In Progress' },
    ];

    const report = await transitionIssues(fake.deps, ['ENG-1'], {
      targetStatus: 'Done',
      dryRun: true,
    });

    expect(report.results[0]).toMatchObject({
      outcome: 'DRY_RUN',
      available: ['Done', 'In Progress'],
    });
    expect(fake.gateway.posted).toEqual([]);
    expect(fake.store.getIssue('ENG-1')).toBeNull();
  });

  it('falla si el workflow no ofrece una transicion al estado destino', async () => {
    const fake = deps();
    fake.gateway.seed(issue('ENG-1'));
    fake.gateway.transitions = [{ id: '21', name: 'Empezar', to: 'In Progress' }];

    const report = await transitionIssues(fake.deps, ['ENG-1'], {
      targetStatus: 'Done',
      dryRun: false,
    });

    expect(report.ok).toBe(false);
    expect(report.results[0]).toMatchObject({
      outcome: 'FAILED',
      available: ['In Progress'],
    });
    expect(report.results[0].error).toContain('Done');
    expect(fake.gateway.posted).toEqual([]);
  });

  it('sigue con las demas issues si una falla', async () => {
    const fake = deps();
    fake.gateway.seed(issue('ENG-1'));
    fake.gateway.transitions = DONE;

    const report = await transitionIssues(fake.deps, ['ENG-1', 'ENG-404'], {
      targetStatus: 'Done',
      dryRun: false,
    });

    expect(report.ok).toBe(false);
    expect(report.results.map((result) => result.outcome)).toEqual([
      'TRANSITIONED',
      'FAILED',
    ]);
    expect(report.results[1]).toMatchObject({ key: 'ENG-404', from: null });
    expect(fake.gateway.posted).toHaveLength(1);
  });

  it('exige un estado destino', async () => {
    const fake = deps();

    await expect(
      transitionIssues(fake.deps, ['ENG-1'], { targetStatus: '  ', dryRun: true })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
