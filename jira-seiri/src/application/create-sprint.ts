import { SeiriError } from '../domain/errors';
import type { JiraBoard, JiraSprint } from '../domain/sprint';
import type { JiraGateway } from '../ports/jira-gateway';
import { resolveSprintBoard } from './list-sprints';

export interface CreateSprintOptions {
  name: string;
  boardId?: number;
  startDate?: string;
  endDate?: string;
  dryRun: boolean;
}

export interface CreateSprintReport {
  board: JiraBoard;
  sprint: JiraSprint | null;
  dryRun: boolean;
  name: string;
  startDate: string | null;
  endDate: string | null;
}

export async function createSprint(
  gateway: JiraGateway,
  projectKey: string,
  options: CreateSprintOptions
): Promise<CreateSprintReport> {
  const name = options.name.trim();
  if (!name) {
    throw new SeiriError('Falta el nombre del sprint', 'VALIDATION');
  }

  const startDate = options.startDate
    ? normalizeDate(options.startDate, 'inicio')
    : undefined;
  const endDate = options.endDate ? normalizeDate(options.endDate, 'fin') : undefined;

  if (startDate && endDate && endDate < startDate) {
    throw new SeiriError(
      'La fecha de fin no puede ser anterior al inicio',
      'VALIDATION'
    );
  }

  const { board } = await resolveSprintBoard(gateway, projectKey, options.boardId);

  if (options.dryRun) {
    return {
      board,
      sprint: null,
      dryRun: true,
      name,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    };
  }

  const sprint = await gateway.createSprint({
    name,
    boardId: board.id,
    startDate,
    endDate,
  });

  return {
    board,
    sprint,
    dryRun: false,
    name,
    startDate: sprint.startDate ?? startDate ?? null,
    endDate: sprint.endDate ?? endDate ?? null,
  };
}

function normalizeDate(value: string, label: string): string {
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw invalidDate(label, value);
    }

    return date.toISOString();
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    throw invalidDate(label, value);
  }

  return new Date(parsed).toISOString();
}

function invalidDate(label: string, value: string): SeiriError {
  return new SeiriError(
    `Fecha de ${label} invalida: ${value}`,
    'VALIDATION',
    'Usa YYYY-MM-DD o un ISO 8601 valido.'
  );
}
