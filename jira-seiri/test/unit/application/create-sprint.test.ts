import { describe, expect, it } from 'vitest';
import { createSprint } from '../../../src/application/create-sprint';
import type { CreateSprintInput, JiraBoard, JiraSprint } from '../../../src/domain/sprint';
import type { JiraGateway } from '../../../src/ports/jira-gateway';

class FakeGateway {
  boards: JiraBoard[] = [];
  readonly created: CreateSprintInput[] = [];

  async listBoards(_projectKey: string): Promise<JiraBoard[]> {
    return [...this.boards];
  }

  async createSprint(input: CreateSprintInput): Promise<JiraSprint> {
    this.created.push(input);
    return {
      id: 37,
      name: input.name,
      state: 'future',
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      boardId: input.boardId,
    };
  }
}

function deps() {
  const fake = new FakeGateway();
  fake.boards = [{ id: 2, name: 'ENG board', type: 'simple' }];
  return { fake, gateway: fake as unknown as JiraGateway };
}

describe('createSprint', () => {
  it('crea el sprint con fechas normalizadas', async () => {
    const { fake, gateway } = deps();

    const report = await createSprint(gateway, 'ENG', {
      name: ' Verificacion feedback octubre ',
      startDate: '2026-10-26',
      endDate: '2026-11-01',
      dryRun: false,
    });

    expect(fake.created).toEqual([
      {
        name: 'Verificacion feedback octubre',
        boardId: 2,
        startDate: '2026-10-26T00:00:00.000Z',
        endDate: '2026-11-01T00:00:00.000Z',
      },
    ]);
    expect(report).toMatchObject({
      board: { id: 2 },
      name: 'Verificacion feedback octubre',
      dryRun: false,
      sprint: { id: 37, state: 'future' },
    });
  });

  it('en dry-run valida el board sin crear', async () => {
    const { fake, gateway } = deps();

    const report = await createSprint(gateway, 'ENG', {
      name: 'Sprint seco',
      dryRun: true,
    });

    expect(report).toMatchObject({ dryRun: true, sprint: null, name: 'Sprint seco' });
    expect(fake.created).toEqual([]);
  });

  it('elige el board indicado cuando hay varios', async () => {
    const { fake, gateway } = deps();
    fake.boards = [
      { id: 1, name: 'Uno', type: 'scrum' },
      { id: 2, name: 'Dos', type: 'simple' },
    ];

    const report = await createSprint(gateway, 'ENG', {
      name: 'Sprint dos',
      boardId: 2,
      dryRun: false,
    });

    expect(report.board.id).toBe(2);
    expect(fake.created[0].boardId).toBe(2);
  });

  it('exige nombre y fechas validas', async () => {
    const { gateway } = deps();

    await expect(
      createSprint(gateway, 'ENG', { name: '  ', dryRun: true })
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      createSprint(gateway, 'ENG', {
        name: 'Sprint',
        startDate: '2026-02-30',
        dryRun: true,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      createSprint(gateway, 'ENG', {
        name: 'Sprint',
        startDate: '2026-11-02',
        endDate: '2026-11-01',
        dryRun: true,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
