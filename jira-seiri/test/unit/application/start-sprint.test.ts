import { describe, expect, it } from 'vitest';
import { startSprint } from '../../../src/application/start-sprint';
import type {
  JiraBoard,
  JiraSprint,
  StartSprintInput,
} from '../../../src/domain/sprint';
import type { JiraGateway } from '../../../src/ports/jira-gateway';

class FakeGateway {
  boards: JiraBoard[] = [{ id: 2, name: 'ENG board', type: 'simple' }];
  sprint: JiraSprint = {
    id: 69,
    name: 'Verificacion',
    state: 'future',
    startDate: '2026-10-26T00:00:00.000Z',
    endDate: '2026-11-01T00:00:00.000Z',
    boardId: 2,
  };
  readonly started: StartSprintInput[] = [];

  async listBoards(_projectKey: string): Promise<JiraBoard[]> {
    return [...this.boards];
  }

  async listSprints(_boardId: number): Promise<JiraSprint[]> {
    return [this.sprint];
  }

  async startSprint(input: StartSprintInput): Promise<JiraSprint> {
    this.started.push(input);
    this.sprint = { ...this.sprint, state: 'active' };
    return this.sprint;
  }
}

function deps() {
  const fake = new FakeGateway();
  return { fake, gateway: fake as unknown as JiraGateway };
}

describe('startSprint', () => {
  it('inicia un sprint futuro', async () => {
    const { fake, gateway } = deps();

    const report = await startSprint(gateway, 'ENG', 69, { dryRun: false });

    expect(report.outcome).toBe('STARTED');
    expect(report.sprint.state).toBe('active');
    expect(fake.started).toEqual([
      {
        id: 69,
        name: 'Verificacion',
        startDate: '2026-10-26T00:00:00.000Z',
        endDate: '2026-11-01T00:00:00.000Z',
      },
    ]);
  });

  it('no repite si el sprint ya esta activo', async () => {
    const { fake, gateway } = deps();
    fake.sprint = { ...fake.sprint, state: 'active' };

    const report = await startSprint(gateway, 'ENG', 69, { dryRun: false });

    expect(report.outcome).toBe('ALREADY');
    expect(fake.started).toEqual([]);
  });

  it('en dry-run no inicia el sprint', async () => {
    const { fake, gateway } = deps();

    const report = await startSprint(gateway, 'ENG', 69, { dryRun: true });

    expect(report.outcome).toBe('DRY_RUN');
    expect(fake.started).toEqual([]);
  });

  it('rechaza un sprint cerrado', async () => {
    const { fake, gateway } = deps();
    fake.sprint = { ...fake.sprint, state: 'closed' };

    await expect(
      startSprint(gateway, 'ENG', 69, { dryRun: false })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(fake.started).toEqual([]);
  });

  it('exige un sprintId valido', async () => {
    const { gateway } = deps();

    await expect(
      startSprint(gateway, 'ENG', 0, { dryRun: true })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
