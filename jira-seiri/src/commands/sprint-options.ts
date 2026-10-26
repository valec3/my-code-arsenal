import { SPRINT_STATES } from '../application/list-sprints';
import { SeiriError } from '../domain/errors';

export function parseBoardId(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parsePositiveInt(value, 'board');
}

export function parseSprintId(value: string): number {
  return parsePositiveInt(value, 'sprintId');
}

export function parseSprintStates(value: string): string[] {
  const states = [...new Set(value.split(',').map((state) => state.trim().toLowerCase()).filter(Boolean))];

  if (states.length === 0) {
    throw new SeiriError('Falta el estado del sprint', 'VALIDATION');
  }

  const valid = new Set<string>(SPRINT_STATES);
  const invalid = states.filter((state) => !valid.has(state));
  if (invalid.length > 0) {
    throw new SeiriError(
      `Estados de sprint invalidos: ${invalid.join(', ')}`,
      'VALIDATION',
      `Validos: ${SPRINT_STATES.join(', ')}.`
    );
  }

  return states;
}

function parsePositiveInt(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new SeiriError(`${label} invalido: ${value}`, 'VALIDATION');
  }
  return parsed;
}
