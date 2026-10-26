import { describe, expect, it } from 'vitest';
import { assignIssues } from '../../../src/application/assign-issues';
import { SeiriError } from '../../../src/domain/errors';
import type { JiraGateway } from '../../../src/ports/jira-gateway';

class FakeGateway {
  readonly assigned: Array<{ key: string; accountId: string }> = [];
  readonly failFor = new Set<string>();

  async assignIssue(key: string, accountId: string): Promise<void> {
    if (this.failFor.has(key)) {
      throw new SeiriError(`No existe la issue ${key}`, 'JIRA');
    }
    this.assigned.push({ key, accountId });
  }
}

function buildGateway() {
  const gateway = new FakeGateway();
  return { gateway, deps: gateway as unknown as JiraGateway };
}

describe('assignIssues', () => {
  it('asigna todas las keys sin repetir y normaliza mayusculas', async () => {
    const fake = buildGateway();
    const seen: string[] = [];

    const report = await assignIssues(fake.deps, [' eng-346 ', 'ENG-346', 'eng-347'], {
      accountId: ' acc-1 ',
      dryRun: false,
      onIssue: (result) => seen.push(`${result.key}:${result.outcome}`),
    });

    expect(report.ok).toBe(true);
    expect(report.accountId).toBe('acc-1');
    expect(fake.gateway.assigned).toEqual([
      { key: 'ENG-346', accountId: 'acc-1' },
      { key: 'ENG-347', accountId: 'acc-1' },
    ]);
    expect(seen).toEqual(['ENG-346:ASSIGNED', 'ENG-347:ASSIGNED']);
  });

  it('sigue con las demas si una falla', async () => {
    const fake = buildGateway();
    fake.gateway.failFor.add('ENG-404');

    const report = await assignIssues(fake.deps, ['ENG-346', 'ENG-404', 'ENG-347'], {
      accountId: 'acc-1',
      dryRun: false,
    });

    expect(report.ok).toBe(false);
    expect(report.results.map((result) => result.outcome)).toEqual([
      'ASSIGNED',
      'FAILED',
      'ASSIGNED',
    ]);
    expect(report.results[1].error).toContain('ENG-404');
    expect(fake.gateway.assigned).toHaveLength(2);
  });

  it('en dry-run no escribe en Jira', async () => {
    const fake = buildGateway();

    const report = await assignIssues(fake.deps, ['ENG-346'], {
      accountId: 'acc-1',
      dryRun: true,
    });

    expect(report.dryRun).toBe(true);
    expect(report.results[0]).toMatchObject({ key: 'ENG-346', outcome: 'DRY_RUN' });
    expect(fake.gateway.assigned).toEqual([]);
  });

  it('exige accountId y keys', async () => {
    const fake = buildGateway();

    await expect(
      assignIssues(fake.deps, ['ENG-346'], { accountId: '  ', dryRun: true })
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      assignIssues(fake.deps, [], { accountId: 'acc-1', dryRun: true })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
