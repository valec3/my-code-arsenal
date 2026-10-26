import { describe, expect, it } from 'vitest';
import { moveIssuesToSprint } from '../../../src/application/move-issues-to-sprint';
import { SeiriError } from '../../../src/domain/errors';
import type { JiraBoard, JiraSprint } from '../../../src/domain/sprint';
import type { JiraGateway } from '../../../src/ports/jira-gateway';

class FakeGateway {
  boards: JiraBoard[] = [];
  sprints: JiraSprint[] = [];
  readonly moved: Array<{ sprintId: number; keys: string[] }> = [];
  readonly failFor = new Set<string>();

  async listBoards(_projectKey: string): Promise<JiraBoard[]> {
    return [...this.boards];
  }

  async listSprints(_boardId: number): Promise<JiraSprint[]> {
    return [...this.sprints];
  }

  async moveIssuesToSprint(sprintId: number, keys: readonly string[]): Promise<void> {
    const key = keys[0];
    if (this.failFor.has(key)) {
      throw new SeiriError(`No existe la issue ${key}`, 'JIRA');
    }
    this.moved.push({ sprintId, keys: [...keys] });
  }
}

function deps(sprintState = 'active') {
  const fake = new FakeGateway();
  fake.boards = [{ id: 1, name: 'Endogastro', type: 'scrum' }];
  fake.sprints = [
    {
      id: 5,
      name: 'Sprint 5',
      state: sprintState,
      startDate: null,
      endDate: null,
      boardId: 1,
    },
  ];

  return { fake, gateway: fake as unknown as JiraGateway };
}

describe('moveIssuesToSprint', () => {
  it('mueve todas las keys sin repetir y normaliza mayusculas', async () => {
    const { fake, gateway } = deps();
    const seen: string[] = [];
    let started = '';

    const report = await moveIssuesToSprint(gateway, 'ENG', [' eng-353 ', 'ENG-353', 'eng-354'], {
      sprintId: 5,
      dryRun: false,
      onStart: (board, sprint) => {
        started = `${board.name}:${sprint.name}`;
      },
      onIssue: (result) => seen.push(`${result.key}:${result.outcome}`),
    });

    expect(report.ok).toBe(true);
    expect(started).toBe('Endogastro:Sprint 5');
    expect(fake.moved).toEqual([
      { sprintId: 5, keys: ['ENG-353'] },
      { sprintId: 5, keys: ['ENG-354'] },
    ]);
    expect(seen).toEqual(['ENG-353:MOVED', 'ENG-354:MOVED']);
  });

  it('sigue con las demas si una falla', async () => {
    const { fake, gateway } = deps();
    fake.failFor.add('ENG-404');

    const report = await moveIssuesToSprint(
      gateway,
      'ENG',
      ['ENG-353', 'ENG-404', 'ENG-354'],
      { sprintId: 5, dryRun: false }
    );

    expect(report.ok).toBe(false);
    expect(report.results.map((result) => result.outcome)).toEqual([
      'MOVED',
      'FAILED',
      'MOVED',
    ]);
    expect(report.results[1].error).toContain('ENG-404');
    expect(fake.moved).toHaveLength(2);
  });

  it('en dry-run valida el sprint pero no mueve', async () => {
    const { fake, gateway } = deps();

    const report = await moveIssuesToSprint(gateway, 'ENG', ['ENG-353'], {
      sprintId: 5,
      dryRun: true,
    });

    expect(report.dryRun).toBe(true);
    expect(report.results[0]).toMatchObject({ key: 'ENG-353', outcome: 'DRY_RUN' });
    expect(fake.moved).toEqual([]);
  });

  it('rechaza mover issues a un sprint cerrado', async () => {
    const { fake, gateway } = deps('closed');

    await expect(
      moveIssuesToSprint(gateway, 'ENG', ['ENG-353'], { sprintId: 5, dryRun: false })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.moved).toEqual([]);
  });

  it('exige sprintId valido y keys', async () => {
    const { gateway } = deps();

    await expect(
      moveIssuesToSprint(gateway, 'ENG', ['ENG-353'], { sprintId: 0, dryRun: true })
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      moveIssuesToSprint(gateway, 'ENG', [], { sprintId: 5, dryRun: true })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
