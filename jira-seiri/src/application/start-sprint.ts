import { SeiriError } from '../domain/errors';
import type { JiraBoard, JiraSprint } from '../domain/sprint';
import type { JiraGateway } from '../ports/jira-gateway';
import { resolveSprint } from './list-sprints';

export type StartSprintOutcome = 'STARTED' | 'ALREADY' | 'DRY_RUN';

export interface StartSprintOptions {
  boardId?: number;
  dryRun: boolean;
}

export interface StartSprintReport {
  board: JiraBoard;
  sprint: JiraSprint;
  dryRun: boolean;
  outcome: StartSprintOutcome;
}

export async function startSprint(
  gateway: JiraGateway,
  projectKey: string,
  sprintId: number,
  options: StartSprintOptions
): Promise<StartSprintReport> {
  if (!Number.isInteger(sprintId) || sprintId <= 0) {
    throw new SeiriError(
      'El sprintId debe ser un entero positivo',
      'VALIDATION',
      'Usa seiri sprints <proyecto> para ver los IDs disponibles.'
    );
  }

  const { board, sprint } = await resolveSprint(
    gateway,
    projectKey,
    sprintId,
    options.boardId
  );

  if (sprint.state.toLowerCase() === 'closed') {
    throw new SeiriError(
      `El sprint ${sprint.id} (${sprint.name}) esta cerrado.`,
      'VALIDATION',
      'Un sprint cerrado no se puede volver a iniciar.'
    );
  }

  if (sprint.state.toLowerCase() === 'active') {
    return { board, sprint, dryRun: options.dryRun, outcome: 'ALREADY' };
  }

  if (options.dryRun) {
    return { board, sprint, dryRun: true, outcome: 'DRY_RUN' };
  }

  const started = await gateway.startSprint({
    id: sprint.id,
    name: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
  });
  return { board, sprint: started, dryRun: false, outcome: 'STARTED' };
}
