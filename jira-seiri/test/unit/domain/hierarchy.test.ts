import { describe, expect, it } from 'vitest';
import type { IssueType } from '../../../src/domain/issue';
import {
  checkPlacement,
  findIssueType,
  suggestIssueTypes,
} from '../../../src/domain/hierarchy';

const EPIC: IssueType = { id: '1', name: 'Epic', hierarchyLevel: 1, subtask: false };
const INITIATIVE: IssueType = { id: '2', name: 'Initiative', hierarchyLevel: 2, subtask: false };
const STORY: IssueType = { id: '3', name: 'Story', hierarchyLevel: 0, subtask: false };
const TASK: IssueType = { id: '4', name: 'Task', hierarchyLevel: 0, subtask: false };
const SUBTASK: IssueType = { id: '5', name: 'Sub-task', hierarchyLevel: -1, subtask: true };
const TYPES = [INITIATIVE, EPIC, STORY, TASK, SUBTASK];

describe('findIssueType', () => {
  it('encuentra el tipo sin importar mayusculas', () => {
    expect(findIssueType(TYPES, 'sub-task')).toBe(SUBTASK);
  });

  it('devuelve null si no existe', () => {
    expect(findIssueType(TYPES, 'Bug')).toBeNull();
  });
});

describe('suggestIssueTypes', () => {
  it('sugiere el tipo mas cercano ante un typo', () => {
    expect(suggestIssueTypes(TYPES, 'Subtask')).toContain('Sub-task');
  });
});

describe('checkPlacement', () => {
  it('exige parent para un subtask', () => {
    const problems = checkPlacement(SUBTASK, null);

    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe('PARENT_REQUIRED');
  });

  it('acepta subtask colgada de una Task', () => {
    expect(checkPlacement(SUBTASK, TASK)).toEqual([]);
  });

  it('rechaza subtask colgada de un Epic', () => {
    const problems = checkPlacement(SUBTASK, EPIC);

    expect(problems[0].code).toBe('PARENT_INVALID');
    expect(problems[0].message).toContain('nivel base');
  });

  it('rechaza subtask colgada de otro subtask', () => {
    expect(checkPlacement(SUBTASK, SUBTASK)[0].code).toBe('PARENT_INVALID');
  });

  it('acepta Task colgada de un Epic', () => {
    expect(checkPlacement(TASK, EPIC)).toEqual([]);
  });

  it('rechaza Task colgada de una Story y sugiere subtask', () => {
    const problems = checkPlacement(TASK, STORY);

    expect(problems[0].code).toBe('PARENT_INVALID');
    expect(problems[0].hint).toContain('subtask');
  });

  it('acepta Epic sin parent', () => {
    expect(checkPlacement(EPIC, null)).toEqual([]);
  });

  it('acepta Epic colgado de una Initiative', () => {
    expect(checkPlacement(EPIC, INITIATIVE)).toEqual([]);
  });

  it('rechaza Epic colgado de una Story', () => {
    expect(checkPlacement(EPIC, STORY)[0].code).toBe('PARENT_INVALID');
  });
});
