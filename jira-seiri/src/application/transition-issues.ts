import { SeiriError } from '../domain/errors';
import type { IssueTransition } from '../domain/transition';
import type { IssueStore } from '../ports/issue-store';
import type { JiraGateway } from '../ports/jira-gateway';

export type TransitionOutcome = 'TRANSITIONED' | 'ALREADY' | 'DRY_RUN' | 'FAILED';

export interface TransitionIssueResult {
  key: string;
  from: string | null;
  to: string;
  outcome: TransitionOutcome;
  transition: { id: string; name: string } | null;
  available: string[];
  error?: string;
}

export interface TransitionReport {
  targetStatus: string;
  dryRun: boolean;
  results: TransitionIssueResult[];
  ok: boolean;
}

export interface TransitionOptions {
  targetStatus: string;
  dryRun: boolean;
  onIssue?: (result: TransitionIssueResult, index: number, total: number) => void;
}

export interface TransitionDeps {
  store: IssueStore;
  gateway: JiraGateway;
}

export async function transitionIssues(
  deps: TransitionDeps,
  keys: readonly string[],
  options: TransitionOptions
): Promise<TransitionReport> {
  const target = options.targetStatus.trim();
  if (!target) {
    throw new SeiriError(
      'Falta el estado destino',
      'VALIDATION',
      'Usa --to <estado>, por ejemplo Done.'
    );
  }

  const unique = [...new Set(keys.map((key) => key.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) {
    throw new SeiriError('No hay keys para transicionar', 'VALIDATION');
  }

  const results: TransitionIssueResult[] = [];

  for (let index = 0; index < unique.length; index++) {
    const key = unique[index];
    let result: TransitionIssueResult;

    try {
      const issue = await deps.gateway.getIssue(key);
      const from = issue.status;

      if (sameStatus(from, target)) {
        result = {
          key,
          from,
          to: from,
          outcome: 'ALREADY',
          transition: null,
          available: [],
        };
      } else {
        const transitions = await deps.gateway.getTransitions(key);
        const match = findTransition(transitions, target);

        if (!match) {
          result = {
            key,
            from,
            to: target,
            outcome: 'FAILED',
            transition: null,
            available: availableStatuses(transitions),
            error: `No hay transicion disponible a "${target}".`,
          };
        } else if (options.dryRun) {
          result = {
            key,
            from,
            to: match.to,
            outcome: 'DRY_RUN',
            transition: { id: match.id, name: match.name },
            available: availableStatuses(transitions),
          };
        } else {
          await deps.gateway.transitionIssue(key, match.id);
          const updated = await deps.gateway.getIssue(key);
          deps.store.upsertIssue(updated);
          result = {
            key,
            from,
            to: updated.status,
            outcome: 'TRANSITIONED',
            transition: { id: match.id, name: match.name },
            available: [],
          };
        }
      }
    } catch (error) {
      result = {
        key,
        from: null,
        to: target,
        outcome: 'FAILED',
        transition: null,
        available: [],
        error: messageOf(error),
      };
    }

    results.push(result);
    options.onIssue?.(result, index + 1, unique.length);
  }

  return {
    targetStatus: target,
    dryRun: options.dryRun,
    results,
    ok: results.every((result) => result.outcome !== 'FAILED'),
  };
}

function findTransition(
  transitions: readonly IssueTransition[],
  target: string
): IssueTransition | undefined {
  return (
    transitions.find((transition) => sameStatus(transition.to, target)) ??
    transitions.find((transition) => sameStatus(transition.name, target))
  );
}

function availableStatuses(transitions: readonly IssueTransition[]): string[] {
  return [...new Set(transitions.map((transition) => transition.to).filter(Boolean))];
}

function sameStatus(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function messageOf(error: unknown): string {
  if (error instanceof SeiriError) {
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
}
