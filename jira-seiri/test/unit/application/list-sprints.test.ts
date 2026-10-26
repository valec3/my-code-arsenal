import { describe, expect, it } from 'vitest';
import {
  listProjectSprints,
  resolveSprint,
  SPRINT_STATES,
} from '../../../src/application/list-sprints';
import type { JiraBoard, JiraSprint } from '../../../src/domain/sprint';
import type { JiraGateway } from '../../../src/ports/jira-gateway';

class FakeGateway {
  boards: JiraBoard[] = [];
  readonly sprintsByBoard = new Map<number, JiraSprint[]>();
  readonly calls: Array<{ boardId: number; states?: readonly string[] }> = [];

  async listBoards(_projectKey: string): Promise<JiraBoard[]> {
    return [...this.boards];
  }

  async listSprints(boardId: number, states?: readonly string[]): Promise<JiraSprint[]> {
    this.calls.push({ boardId, states });
    return [...(this.sprintsByBoard.get(boardId) ?? [])];
  }
}

function deps() {
  const fake = new FakeGateway();
  return { fake, gateway: fake as unknown as JiraGateway };
}

function board(id: number, name: string, type = 'scrum'): JiraBoard {
  return { id, name, type };
}

function sprint(id: number, name: string, state = 'active'): JiraSprint {
  return {
    id,
    name,
    state,
    startDate: '2026-10-26T00:00:00.000Z',
    endDate: '2026-11-01T00:00:00.000Z',
    boardId: 1,
  };
}

describe('listProjectSprints', () => {
  it('usa el unico board Scrum y ordena los sprints por id', async () => {
    const { fake, gateway } = deps();
    fake.boards = [board(7, 'Endogastro')];
    fake.sprintsByBoard.set(7, [sprint(12, 'Sprint 2'), sprint(11, 'Sprint 1')]);

    const report = await listProjectSprints(gateway, 'ENG');

    expect(report.board).toEqual(board(7, 'Endogastro'));
    expect(report.sprints.map((item) => item.id)).toEqual([11, 12]);
    expect(fake.calls).toEqual([{ boardId: 7, states: SPRINT_STATES }]);
  });

  it('ignora boards Kanban', async () => {
    const { fake, gateway } = deps();
    fake.boards = [board(1, 'Kanban', 'kanban')];

    await expect(listProjectSprints(gateway, 'ENG')).rejects.toMatchObject({
      code: 'CONFIG',
    });
  });

  it('acepta boards simple de proyectos team-managed', async () => {
    const { fake, gateway } = deps();
    fake.boards = [board(2, 'ENG board', 'simple')];
    fake.sprintsByBoard.set(2, [sprint(36, 'ENG Sprint 4')]);

    const report = await listProjectSprints(gateway, 'ENG');

    expect(report.board).toMatchObject({ id: 2, type: 'simple' });
    expect(report.sprints).toHaveLength(1);
  });

  it('exige --board si hay varios boards Scrum', async () => {
    const { fake, gateway } = deps();
    fake.boards = [board(1, 'Uno'), board(2, 'Dos')];

    await expect(listProjectSprints(gateway, 'ENG')).rejects.toMatchObject({
      code: 'VALIDATION',
      hint: expect.stringContaining('1 (Uno)'),
    });
  });

  it('selecciona el board indicado', async () => {
    const { fake, gateway } = deps();
    fake.boards = [board(1, 'Uno'), board(2, 'Dos')];
    fake.sprintsByBoard.set(2, [sprint(20, 'Sprint 20')]);

    const report = await listProjectSprints(gateway, 'ENG', { boardId: 2 });

    expect(report.board.id).toBe(2);
    expect(fake.calls[0].boardId).toBe(2);
  });

  it('rechaza un board que no es Scrum', async () => {
    const { fake, gateway } = deps();
    fake.boards = [board(1, 'Uno')];

    await expect(
      listProjectSprints(gateway, 'ENG', { boardId: 99 })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('resolveSprint', () => {
  it('encuentra el sprint y su board', async () => {
    const { fake, gateway } = deps();
    fake.boards = [board(1, 'Uno')];
    fake.sprintsByBoard.set(1, [sprint(42, 'Sprint 42', 'future')]);

    await expect(resolveSprint(gateway, 'ENG', 42)).resolves.toMatchObject({
      board: { id: 1 },
      sprint: { id: 42, name: 'Sprint 42' },
    });
  });

  it('falla con los sprints disponibles si no existe', async () => {
    const { fake, gateway } = deps();
    fake.boards = [board(1, 'Uno')];
    fake.sprintsByBoard.set(1, [sprint(42, 'Sprint 42')]);

    await expect(resolveSprint(gateway, 'ENG', 99)).rejects.toMatchObject({
      code: 'VALIDATION',
      hint: expect.stringContaining('42 (Sprint 42)'),
    });
  });
});
