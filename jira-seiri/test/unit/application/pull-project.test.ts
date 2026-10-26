import { describe, expect, it, vi } from 'vitest';
import { defaultJql, pullProject } from '../../../src/application/pull-project';
import type { Issue } from '../../../src/domain/issue';
import type { JiraGateway } from '../../../src/ports/jira-gateway';
import type { IssueStore, ProjectSnapshot } from '../../../src/ports/issue-store';

const ISSUE: Issue = {
  key: 'ENG-1',
  projectKey: 'ENG',
  parentKey: null,
  summary: 'Epic base',
  description: '',
  issueType: 'Epic',
  hierarchyLevel: 1,
  status: 'To Do',
  priority: null,
  storyPoints: null,
  jiraCreatedAt: null,
  jiraUpdatedAt: '2026-01-02T00:00:00.000+0000',
};

function gatewayWith(searchIssues: ReturnType<typeof vi.fn>): JiraGateway {
  return {
    getMyself: vi.fn(),
    getProject: vi.fn(async () => ({ key: 'ENG', name: 'Engineering' })),
    getIssueTypes: vi.fn(async () => [
      { id: '1', name: 'Epic', hierarchyLevel: 1, subtask: false },
    ]),
    getFields: vi.fn(),
    createIssue: vi.fn(),
    deleteIssue: vi.fn(),
    searchIssues,
  } as unknown as JiraGateway;
}

function memoryStore(): IssueStore {
  return {
    saveSnapshot: () => {},
    listIssues: () => [ISSUE],
    countIssues: () => 1,
  };
}

describe('pullProject', () => {
  it('orquesta el pull, guarda el snapshot y arma el contexto', async () => {
    const searchIssues = vi.fn(async () => [ISSUE]);
    let snapshot: ProjectSnapshot | undefined;
    const store: IssueStore = {
      ...memoryStore(),
      saveSnapshot: (value) => {
        snapshot = value;
      },
    };

    const result = await pullProject(
      { gateway: gatewayWith(searchIssues), store },
      {
        project: 'endogastro',
        projectKey: 'ENG',
        host: 'https://acme.atlassian.net',
        days: 30,
        maxIssues: 10,
        storyPointsField: 'customfield_10016',
      }
    );

    expect(searchIssues).toHaveBeenCalledWith(
      defaultJql('ENG', 30),
      expect.arrayContaining(['customfield_10016'])
    );
    expect(snapshot?.project).toEqual({ key: 'ENG', name: 'Engineering' });
    expect(result).toMatchObject({ fetched: 1, local: 1, issueTypes: 1 });
    expect(result.contextMarkdown).toContain('# Contexto Jira — ENG');
  });

  it('respeta un JQL explicito', async () => {
    const searchIssues = vi.fn(async () => [ISSUE]);

    await pullProject(
      { gateway: gatewayWith(searchIssues), store: memoryStore() },
      {
        project: 'endogastro',
        projectKey: 'ENG',
        host: 'https://acme.atlassian.net',
        days: 30,
        jql: 'project = ENG AND status = "To Do"',
        maxIssues: 10,
      }
    );

    expect(searchIssues).toHaveBeenCalledWith(
      'project = ENG AND status = "To Do"',
      expect.any(Array)
    );
  });
});
