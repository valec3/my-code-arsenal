import { SeiriError } from '../domain/errors';
import type { JiraBoard, JiraSprint } from '../domain/sprint';
import type { JiraGateway } from '../ports/jira-gateway';

export const SPRINT_STATES = ['active', 'future', 'closed'] as const;

export interface ListSprintsOptions {
  boardId?: number;
  states?: readonly string[];
}

export interface SprintListReport {
  projectKey: string;
  boards: JiraBoard[];
  board: JiraBoard;
  sprints: JiraSprint[];
}

export interface ResolvedSprint {
  board: JiraBoard;
  sprint: JiraSprint;
}

export async function listProjectSprints(
  gateway: JiraGateway,
  projectKey: string,
  options: ListSprintsOptions = {}
): Promise<SprintListReport> {
  const boards = await gateway.listBoards(projectKey);
  const sprintBoards = boards.filter((board) => isSprintBoard(board));

  if (sprintBoards.length === 0) {
    const found =
      boards.length > 0
        ? boards
            .map((candidate) => `${candidate.id} (${candidate.name}, ${candidate.type})`)
            .join(', ')
        : 'ninguno';

    throw new SeiriError(
      `El proyecto ${projectKey} no tiene boards con sprints.`,
      'CONFIG',
      `Los sprints requieren un board Scrum (scrum o simple). Boards encontrados: ${found}.`
    );
  }

  let board: JiraBoard | undefined;
  if (options.boardId !== undefined) {
    board = sprintBoards.find((candidate) => candidate.id === options.boardId);
    if (!board) {
      throw new SeiriError(
        `El board ${options.boardId} no es un board con sprints de ${projectKey}.`,
        'VALIDATION',
        `Boards disponibles: ${describeBoards(sprintBoards)}.`
      );
    }
  } else if (sprintBoards.length === 1) {
    board = sprintBoards[0];
  }

  if (!board) {
    throw new SeiriError(
      `El proyecto ${projectKey} tiene varios boards con sprints.`,
      'VALIDATION',
      `Usa --board con uno de: ${describeBoards(sprintBoards)}.`
    );
  }

  const sprints = await gateway.listSprints(
    board.id,
    options.states ?? SPRINT_STATES
  );

  return {
    projectKey,
    boards,
    board,
    sprints: [...sprints].sort((left, right) => left.id - right.id),
  };
}

export async function resolveSprint(
  gateway: JiraGateway,
  projectKey: string,
  sprintId: number,
  boardId?: number
): Promise<ResolvedSprint> {
  const { board, sprints } = await listProjectSprints(gateway, projectKey, { boardId });
  const sprint = sprints.find((candidate) => candidate.id === sprintId);

  if (!sprint) {
    const available =
      sprints.length > 0
        ? sprints.map((candidate) => `${candidate.id} (${candidate.name})`).join(', ')
        : 'ninguno';

    throw new SeiriError(
      `No existe el sprint ${sprintId} en el board "${board.name}".`,
      'VALIDATION',
      `Sprints disponibles: ${available}.`
    );
  }

  return { board, sprint };
}

function isSprintBoard(board: JiraBoard): boolean {
  const type = board.type.toLowerCase();
  return type === 'scrum' || type === 'simple';
}

function describeBoards(boards: readonly JiraBoard[]): string {
  return boards.map((board) => `${board.id} (${board.name})`).join(', ');
}
