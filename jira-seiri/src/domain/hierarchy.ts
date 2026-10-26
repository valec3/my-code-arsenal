import type { IssueType } from './issue';

export interface PlacementProblem {
  code: 'PARENT_REQUIRED' | 'PARENT_INVALID';
  message: string;
  hint?: string;
}

export function findIssueType(types: readonly IssueType[], name: string): IssueType | null {
  const target = name.trim().toLowerCase();
  return types.find((type) => type.name.toLowerCase() === target) ?? null;
}

export function suggestIssueTypes(
  types: readonly IssueType[],
  name: string,
  limit = 3
): string[] {
  const target = name.trim().toLowerCase();
  return types
    .map((type) => ({ name: type.name, distance: distance(type.name.toLowerCase(), target) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, limit)
    .map((entry) => entry.name);
}

export function checkPlacement(
  type: IssueType,
  parent: IssueType | null
): PlacementProblem[] {
  if (type.subtask) {
    if (!parent) {
      return [
        {
          code: 'PARENT_REQUIRED',
          message: `El tipo "${type.name}" es subtask y necesita parent.`,
          hint: 'Apunta al key de una Story/Task existente o al local_ref de otro item del archivo.',
        },
      ];
    }

    if (parent.subtask) {
      return [
        {
          code: 'PARENT_INVALID',
          message: `"${type.name}" no puede colgar de "${parent.name}": un subtask no admite otro subtask como padre.`,
        },
      ];
    }

    if (parent.hierarchyLevel !== 0) {
      return [
        {
          code: 'PARENT_INVALID',
          message: `"${type.name}" necesita un padre de nivel base (0), pero "${parent.name}" es nivel ${parent.hierarchyLevel}.`,
        },
      ];
    }

    return [];
  }

  if (!parent) {
    return [];
  }

  if (parent.subtask) {
    return [
      {
        code: 'PARENT_INVALID',
        message: `"${type.name}" no puede colgar de "${parent.name}": un subtask no puede tener hijos.`,
      },
    ];
  }

  if (parent.hierarchyLevel <= type.hierarchyLevel) {
    return [
      {
        code: 'PARENT_INVALID',
        message: `"${type.name}" (nivel ${type.hierarchyLevel}) no puede colgar de "${parent.name}" (nivel ${parent.hierarchyLevel}): el padre debe tener nivel mayor.`,
        hint:
          type.hierarchyLevel === 0
            ? 'Si queres desglosar una Story o Task, usa un tipo subtask.'
            : undefined,
      },
    ];
  }

  return [];
}

function distance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  let previous = Array.from({ length: columns }, (_, index) => index);

  for (let row = 1; row < rows; row++) {
    const current = [row];
    for (let column = 1; column < columns; column++) {
      const substitution = previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, substitution);
    }
    previous = current;
  }

  return previous[columns - 1];
}
