import { describe, expect, it } from 'vitest';
import { buildContext } from '../../../src/application/build-context';
import type { Issue, IssueType } from '../../../src/domain/issue';

const TYPES: IssueType[] = [
  { id: '1', name: 'Epic', hierarchyLevel: 1, subtask: false },
  { id: '2', name: 'Task', hierarchyLevel: 0, subtask: false },
  { id: '3', name: 'Sub-task', hierarchyLevel: -1, subtask: true },
];

const OPTIONS = {
  project: 'endogastro',
  projectKey: 'ENG',
  host: 'https://acme.atlassian.net',
  days: 30,
  maxIssues: 10,
};

type IssueOverrides = Partial<Issue> & { key: string; updated: string };

function issue({ updated, ...overrides }: IssueOverrides): Issue {
  return {
    projectKey: 'ENG',
    parentKey: null,
    summary: 'Resumen',
    description: '',
    issueType: 'Task',
    hierarchyLevel: 0,
    status: 'To Do',
    priority: null,
    storyPoints: null,
    jiraCreatedAt: null,
    jiraUpdatedAt: updated,
    ...overrides,
  };
}

describe('buildContext', () => {
  it('renderiza la jerarquia anidada y los tipos', () => {
    const markdown = buildContext(
      [
        issue({
          key: 'ENG-1',
          updated: '2026-01-02',
          summary: 'Epic base',
          issueType: 'Epic',
          hierarchyLevel: 1,
        }),
        issue({
          key: 'ENG-2',
          updated: '2026-01-03',
          summary: 'Tarea hija',
          parentKey: 'ENG-1',
          status: 'In Progress',
        }),
        issue({
          key: 'ENG-3',
          updated: '2026-01-04',
          summary: 'Subtarea',
          parentKey: 'ENG-2',
          issueType: 'Sub-task',
          hierarchyLevel: -1,
        }),
      ],
      TYPES,
      OPTIONS
    );

    expect(markdown).toContain('# Contexto Jira — ENG');
    expect(markdown).toContain('- [ENG-1] (Epic, To Do) Epic base');
    expect(markdown).toContain('  - [ENG-2] (Task, In Progress) Tarea hija');
    expect(markdown).toContain('    - [ENG-3] (Sub-task, To Do) Subtarea');
    expect(markdown).toContain('- Sub-task — hierarchyLevel -1 (subtask)');
  });

  it('trunca por maxIssues y lo avisa', () => {
    const issues = [1, 2, 3].map((n) =>
      issue({ key: `ENG-${n}`, updated: `2026-01-0${n}`, summary: `Issue ${n}` })
    );

    const markdown = buildContext(issues, TYPES, { ...OPTIONS, maxIssues: 2 });

    expect(markdown).toContain('mostrando 2');
    expect(markdown).toContain('de 3 issues');
    expect(markdown).toContain('--max-issues');
  });

  it('muestra como raiz un hijo cuyo padre no fue seleccionado', () => {
    const markdown = buildContext(
      [
        issue({ key: 'ENG-1', updated: '2026-01-01', summary: 'Padre' }),
        issue({ key: 'ENG-2', updated: '2026-01-02', summary: 'Huerfano', parentKey: 'ENG-1' }),
      ],
      TYPES,
      { ...OPTIONS, maxIssues: 1 }
    );

    expect(markdown).toContain('\n- [ENG-2] (Task, To Do) Huerfano');
    expect(markdown).not.toContain('[ENG-1]');
  });

  it('usa el JQL en el encabezado cuando se provee', () => {
    const markdown = buildContext([], TYPES, {
      ...OPTIONS,
      jql: 'project = ENG ORDER BY updated DESC',
    });

    expect(markdown).toContain('JQL: `project = ENG ORDER BY updated DESC`');
    expect(markdown).toContain('_Sin issues sincronizados._');
  });
});
