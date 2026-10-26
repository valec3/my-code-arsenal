import { SeiriError } from '../domain/errors';
import type { JiraGateway } from '../ports/jira-gateway';

export type AssignOutcome = 'ASSIGNED' | 'DRY_RUN' | 'FAILED';

export interface AssignIssueResult {
  key: string;
  accountId: string;
  outcome: AssignOutcome;
  error?: string;
}

export interface AssignReport {
  accountId: string;
  dryRun: boolean;
  results: AssignIssueResult[];
  ok: boolean;
}

export interface AssignOptions {
  accountId: string;
  dryRun: boolean;
  onIssue?: (result: AssignIssueResult, index: number, total: number) => void;
}

export async function assignIssues(
  gateway: JiraGateway,
  keys: readonly string[],
  options: AssignOptions
): Promise<AssignReport> {
  const accountId = options.accountId.trim();
  if (!accountId) {
    throw new SeiriError(
      'Falta el accountId del usuario',
      'VALIDATION',
      'Usa seiri users <proyecto> para obtener los accountId disponibles.'
    );
  }

  const unique = [...new Set(keys.map((key) => key.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) {
    throw new SeiriError('No hay keys para asignar', 'VALIDATION');
  }

  const results: AssignIssueResult[] = [];

  for (let index = 0; index < unique.length; index++) {
    const key = unique[index];
    let result: AssignIssueResult;

    if (options.dryRun) {
      result = { key, accountId, outcome: 'DRY_RUN' };
    } else {
      try {
        await gateway.assignIssue(key, accountId);
        result = { key, accountId, outcome: 'ASSIGNED' };
      } catch (error) {
        result = {
          key,
          accountId,
          outcome: 'FAILED',
          error: messageOf(error),
        };
      }
    }

    results.push(result);
    options.onIssue?.(result, index + 1, unique.length);
  }

  return {
    accountId,
    dryRun: options.dryRun,
    results,
    ok: results.every((result) => result.outcome !== 'FAILED'),
  };
}

function messageOf(error: unknown): string {
  if (error instanceof SeiriError) {
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
}
