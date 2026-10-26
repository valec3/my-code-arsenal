import { SeiriError } from '../domain/errors';
import type { JiraBoard, JiraSprint } from '../domain/sprint';
import type { JiraGateway } from '../ports/jira-gateway';
import { resolveSprint } from './list-sprints';

export type SprintMoveOutcome = 'MOVED' | 'DRY_RUN' | 'FAILED';

export interface SprintMoveResult {
  key: string;
  outcome: SprintMoveOutcome;
  error?: string;
}

export interface SprintMoveReport {
  board: JiraBoard;
  sprint: JiraSprint;
  dryRun: boolean;
  results: SprintMoveResult[];
  ok: boolean;
}

export interface MoveIssuesToSprintOptions {
  sprintId: number;
  boardId?: number;
  dryRun: boolean;
  onStart?: (board: JiraBoard, sprint: JiraSprint) => void;
  onIssue?: (result: SprintMoveResult, index: number, total: number) => void;
}

export async function moveIssuesToSprint(
  gateway: JiraGateway,
  projectKey: string,
  keys: readonly string[],
  options: MoveIssuesToSprintOptions
): Promise<SprintMoveReport> {
  if (!Number.isInteger(options.sprintId) || options.sprintId <= 0) {
    throw new SeiriError(
      'El sprintId debe ser un entero positivo',
      'VALIDATION',
      'Usa seiri sprints <proyecto> para ver los IDs disponibles.'
    );
  }

  const unique = [...new Set(keys.map((key) => key.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) {
    throw new SeiriError('No hay keys para mover', 'VALIDATION');
  }

  const { board, sprint } = await resolveSprint(
    gateway,
    projectKey,
    options.sprintId,
    options.boardId
  );

  if (sprint.state.toLowerCase() === 'closed') {
    throw new SeiriError(
      `El sprint ${sprint.id} (${sprint.name}) esta cerrado.`,
      'VALIDATION',
      'Elegi un sprint active o future.'
    );
  }

  options.onStart?.(board, sprint);

  const results: SprintMoveResult[] = [];

  for (let index = 0; index < unique.length; index++) {
    const key = unique[index];
    let result: SprintMoveResult;

    if (options.dryRun) {
      result = { key, outcome: 'DRY_RUN' };
    } else {
      try {
        await gateway.moveIssuesToSprint(sprint.id, [key]);
        result = { key, outcome: 'MOVED' };
      } catch (error) {
        result = { key, outcome: 'FAILED', error: messageOf(error) };
      }
    }

    results.push(result);
    options.onIssue?.(result, index + 1, unique.length);
  }

  return {
    board,
    sprint,
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
