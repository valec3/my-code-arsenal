import type { IssueType } from '../domain/issue';
import type { MigrationFile, MigrationItem } from '../domain/migration';
import { checkPlacement, findIssueType, suggestIssueTypes } from '../domain/hierarchy';
import { similarityPercent } from '../domain/similarity';
import type { IssueStore } from '../ports/issue-store';

export type ValidationErrorCode =
  | 'PROJECT'
  | 'UNKNOWN_TYPE'
  | 'PARENT'
  | 'HIERARCHY'
  | 'CYCLE';

export interface ValidationError {
  code: ValidationErrorCode;
  ref?: string;
  message: string;
  hint?: string;
}

export interface DuplicateFinding {
  ref: string;
  score: number;
  summary: string;
  source: 'existing' | 'in_file';
  key?: string;
  status?: string;
  otherRef?: string;
}

export interface ValidationReport {
  file: string;
  project: string;
  projectKey: string | null;
  threshold: number;
  itemCount: number;
  errors: ValidationError[];
  duplicates: DuplicateFinding[];
  ok: boolean;
}

export interface ValidateOptions {
  file: string;
  threshold?: number;
  candidates?: number;
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_CANDIDATES = 10;
const MAX_DUPLICATES_PER_ITEM = 3;

export function validateMigration(
  deps: { store: IssueStore },
  migration: MigrationFile,
  options: ValidateOptions
): ValidationReport {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const candidates = options.candidates ?? DEFAULT_CANDIDATES;
  const errors: ValidationError[] = [];
  const duplicates: DuplicateFinding[] = [];

  const projectKey = resolveProjectKey(deps.store, errors);
  const itemCount = migration.items.length;
  const refMap = new Map(migration.items.map((item) => [item.local_ref, item]));

  collectCycles(refMap, errors);
  collectInFileDuplicates(migration.items, threshold, duplicates);

  if (!projectKey) {
    return report(migration, options.file, errors, duplicates, threshold, itemCount, null);
  }

  const types = deps.store.listIssueTypes(projectKey);
  if (types.length === 0) {
    errors.push({
      code: 'PROJECT',
      message: `La base local no tiene tipos de issue para "${projectKey}".`,
      hint: 'Corre seiri pull para sincronizar el createmeta del proyecto.',
    });
  }

  const resolvedTypes = new Map<string, IssueType>();

  for (const item of migration.items) {
    const type = findIssueType(types, item.type);
    if (!type) {
      const suggestions = suggestIssueTypes(types, item.type);
      errors.push({
        code: 'UNKNOWN_TYPE',
        ref: item.local_ref,
        message: `Tipo de issue desconocido: "${item.type}".`,
        hint:
          suggestions.length > 0
            ? `Tipos disponibles cercanos: ${suggestions.join(', ')}.`
            : 'Corre seiri pull para refrescar los tipos del proyecto.',
      });
      continue;
    }

    resolvedTypes.set(item.local_ref, type);
  }

  for (const item of migration.items) {
    const type = resolvedTypes.get(item.local_ref);
    if (!type) {
      continue;
    }

    const parent = resolveParentType(deps.store, types, refMap, item, errors);
    if (parent === 'failed') {
      continue;
    }

    for (const problem of checkPlacement(type, parent)) {
      errors.push({
        code: 'HIERARCHY',
        ref: item.local_ref,
        message: problem.message,
        hint: problem.hint,
      });
    }
  }

  for (const item of migration.items) {
    const found = findExistingDuplicates(deps.store, projectKey, item, threshold, candidates);
    duplicates.push(...found);
  }

  return report(migration, options.file, errors, duplicates, threshold, itemCount, projectKey);
}

function report(
  migration: MigrationFile,
  file: string,
  errors: ValidationError[],
  duplicates: DuplicateFinding[],
  threshold: number,
  itemCount: number,
  projectKey: string | null
): ValidationReport {
  return {
    file,
    project: migration.project,
    projectKey,
    threshold,
    itemCount,
    errors,
    duplicates,
    ok: errors.length === 0 && duplicates.length === 0,
  };
}

function resolveProjectKey(store: IssueStore, errors: ValidationError[]): string | null {
  const keys = store.listProjectKeys();

  if (keys.length === 0) {
    errors.push({
      code: 'PROJECT',
      message: 'La base local no tiene proyectos sincronizados.',
      hint: 'Corre seiri pull <proyecto> antes de validar una migracion.',
    });
    return null;
  }

  if (keys.length > 1) {
    errors.push({
      code: 'PROJECT',
      message: `La base local tiene varios proyectos (${keys.join(', ')}); se espera una base por proyecto.`,
      hint: 'Borra el cache del proyecto y volve a correr seiri pull.',
    });
    return null;
  }

  return keys[0];
}

function resolveParentType(
  store: IssueStore,
  types: readonly IssueType[],
  refMap: Map<string, MigrationItem>,
  item: MigrationItem,
  errors: ValidationError[]
): IssueType | null | 'failed' {
  if (!item.parent) {
    return null;
  }

  const localParent = refMap.get(item.parent);
  if (localParent) {
    return findIssueType(types, localParent.type);
  }

  const existing = store.getIssue(item.parent);
  if (!existing) {
    errors.push({
      code: 'PARENT',
      ref: item.local_ref,
      message: `El parent "${item.parent}" no existe en la base local.`,
      hint: 'Corre seiri pull o usa un key que aparezca en .jira_context.md.',
    });
    return 'failed';
  }

  const type = findIssueType(types, existing.issueType);
  if (type) {
    return type;
  }

  return {
    id: '',
    name: existing.issueType,
    hierarchyLevel: existing.hierarchyLevel,
    subtask: existing.hierarchyLevel < 0,
  };
}

function findExistingDuplicates(
  store: IssueStore,
  projectKey: string,
  item: MigrationItem,
  threshold: number,
  candidates: number
): DuplicateFinding[] {
  const found: DuplicateFinding[] = [];

  for (const candidate of store.searchSimilar(projectKey, item.summary, candidates)) {
    const score = similarityPercent(item.summary, candidate.summary);
    if (score >= threshold) {
      found.push({
        ref: item.local_ref,
        score,
        summary: candidate.summary,
        source: 'existing',
        key: candidate.key,
        status: candidate.status,
      });
    }
  }

  return found
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_DUPLICATES_PER_ITEM);
}

function collectInFileDuplicates(
  items: readonly MigrationItem[],
  threshold: number,
  duplicates: DuplicateFinding[]
): void {
  for (let left = 0; left < items.length; left++) {
    for (let right = left + 1; right < items.length; right++) {
      const score = similarityPercent(items[left].summary, items[right].summary);
      if (score >= threshold) {
        duplicates.push({
          ref: items[left].local_ref,
          otherRef: items[right].local_ref,
          score,
          summary: items[right].summary,
          source: 'in_file',
        });
      }
    }
  }
}

function collectCycles(
  refMap: Map<string, MigrationItem>,
  errors: ValidationError[]
): void {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const reported = new Set<string>();

  const visit = (ref: string): void => {
    if (state.get(ref) === 'done') {
      return;
    }

    if (state.get(ref) === 'visiting') {
      const start = stack.indexOf(ref);
      if (start >= 0) {
        const cycle = [...stack.slice(start), ref];
        const signature = [...new Set(cycle)].sort().join('|');
        if (!reported.has(signature)) {
          reported.add(signature);
          errors.push({
            code: 'CYCLE',
            ref,
            message: `Ciclo de padres: ${cycle.join(' -> ')}.`,
            hint: 'Cada item debe colgar de un padre distinto; revisa los local_ref.',
          });
        }
      }
      return;
    }

    state.set(ref, 'visiting');
    stack.push(ref);

    const parent = refMap.get(ref)?.parent;
    if (parent && refMap.has(parent)) {
      visit(parent);
    }

    stack.pop();
    state.set(ref, 'done');
  };

  for (const ref of refMap.keys()) {
    visit(ref);
  }
}
