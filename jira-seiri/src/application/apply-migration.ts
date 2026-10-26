import type { Issue, IssueType } from '../domain/issue';
import type { MigrationFile, MigrationItem } from '../domain/migration';
import { SeiriError } from '../domain/errors';
import { validateMigration, type DuplicateFinding, type ValidationReport } from './validate-migration';
import type { IssueStore } from '../ports/issue-store';
import type { JiraGateway } from '../ports/jira-gateway';
import type { MigrationStore } from '../ports/migration-store';

export type ApplyStatus = 'DRY_RUN' | 'SUCCESS' | 'PARTIAL' | 'SKIPPED';

export interface ApplyPlanEntry {
  localRef: string;
  type: string;
  parent: string | null;
  summary: string;
}

export interface ApplyItemEvent {
  index: number;
  total: number;
  localRef: string;
  status: 'CREATED' | 'SKIPPED' | 'FAILED';
  issueKey?: string;
  error?: string;
}

export interface ApplyResult {
  filename: string;
  projectKey: string;
  status: ApplyStatus;
  plan: ApplyPlanEntry[];
  created: Array<{ localRef: string; issueKey: string }>;
  skipped: string[];
  failures: Array<{ localRef: string; error: string }>;
  duplicates: DuplicateFinding[];
}

export interface ApplyOptions {
  file: string;
  projectKey: string;
  checksum: string;
  description?: string;
  dryRun: boolean;
  allowDuplicates: boolean;
  threshold?: number;
  onItem?: (event: ApplyItemEvent) => void;
}

export interface ApplyDeps {
  store: IssueStore;
  migrations: MigrationStore;
  createGateway?: () => JiraGateway;
}

export async function applyMigration(
  deps: ApplyDeps,
  migration: MigrationFile,
  options: ApplyOptions
): Promise<ApplyResult> {
  const filename = baseName(options.file);
  const ordered = orderItems(migration.items);
  const plan: ApplyPlanEntry[] = ordered.map((item) => ({
    localRef: item.local_ref,
    type: item.type,
    parent: item.parent ?? null,
    summary: item.summary,
  }));

  const existing = deps.migrations.get(filename);
  if (existing && existing.checksum !== options.checksum) {
    throw new SeiriError(
      `La migracion "${filename}" cambio despues de aplicada.`,
      'VALIDATION',
      'Crea un archivo nuevo en vez de editar una migracion ya aplicada.'
    );
  }

  if (existing?.status === 'SUCCESS') {
    return {
      filename,
      projectKey: options.projectKey,
      status: 'SKIPPED',
      plan,
      created: [],
      skipped: ordered.map((item) => item.local_ref),
      failures: [],
      duplicates: [],
    };
  }

  const done = new Map<string, string>();
  for (const record of deps.migrations.listItems(filename)) {
    if (record.status === 'CREATED' && record.localRef && record.issueKey) {
      done.set(record.localRef, record.issueKey);
    }
  }

  const report = validateMigration(
    { store: deps.store },
    migration,
    {
      file: options.file,
      threshold: options.threshold,
      ignoreRefs: [...done.keys()],
      ignoreKeys: [...done.values()],
    }
  );

  if (report.errors.length > 0) {
    throw new SeiriError(
      'La migracion no paso validate; no se creo nada.',
      'VALIDATION',
      summarizeErrors(report)
    );
  }

  if (report.duplicates.length > 0 && !options.allowDuplicates) {
    throw new SeiriError(
      `Hay ${report.duplicates.length} duplicado(s) posible(s); no se creo nada.`,
      'DUPLICATE',
      `${summarizeDuplicates(report)}\nRevisalos o corre apply con --allow-duplicates.`
    );
  }

  if (options.dryRun) {
    return {
      filename,
      projectKey: options.projectKey,
      status: 'DRY_RUN',
      plan,
      created: [],
      skipped: [],
      failures: [],
      duplicates: report.duplicates,
    };
  }

  const gateway = deps.createGateway?.();
  if (!gateway) {
    throw new SeiriError('Falta el cliente de Jira para aplicar.', 'APPLY');
  }

  if (!existing) {
    deps.migrations.save({
      filename,
      description: options.description ?? migration.description ?? null,
      version: migration.version,
      checksum: options.checksum,
      status: 'PENDING',
    });
  }

  const types = deps.store.listIssueTypes(options.projectKey);
  const localRefs = new Set(migration.items.map((item) => item.local_ref));
  const created: Array<{ localRef: string; issueKey: string }> = [];
  const skipped: string[] = [];
  const failures: Array<{ localRef: string; error: string }> = [];

  for (let index = 0; index < ordered.length; index++) {
    const item = ordered[index];
    const total = ordered.length;

    if (done.has(item.local_ref)) {
      skipped.push(item.local_ref);
      options.onItem?.({ index: index + 1, total, localRef: item.local_ref, status: 'SKIPPED' });
      continue;
    }

    const parentKey = resolveParentKey(item, localRefs, done);

    try {
      const response = await gateway.createIssue({
        projectKey: options.projectKey,
        summary: item.summary,
        description: item.description ?? '',
        issueType: item.type,
        parentKey: parentKey ?? undefined,
        priority: item.priority,
        storyPoints: item.story_points,
      });

      const issue = await readCreatedIssue(gateway, response.key, {
        item,
        projectKey: options.projectKey,
        parentKey,
        type: types.find((candidate) => candidate.name === item.type),
      });

      deps.store.upsertIssue(issue);
      deps.migrations.saveItem({
        filename,
        operationIndex: migration.items.indexOf(item),
        localRef: item.local_ref,
        action: item.action,
        issueType: item.type,
        parentKey,
        summary: item.summary,
        status: 'CREATED',
        issueKey: response.key,
      });

      done.set(item.local_ref, response.key);
      created.push({ localRef: item.local_ref, issueKey: response.key });
      options.onItem?.({
        index: index + 1,
        total,
        localRef: item.local_ref,
        status: 'CREATED',
        issueKey: response.key,
      });
    } catch (error) {
      const message = messageOf(error);
      deps.migrations.saveItem({
        filename,
        operationIndex: migration.items.indexOf(item),
        localRef: item.local_ref,
        action: item.action,
        issueType: item.type,
        parentKey,
        summary: item.summary,
        status: 'FAILED',
        error: message,
      });
      deps.migrations.setStatus(filename, 'PARTIAL');

      failures.push({ localRef: item.local_ref, error: message });
      options.onItem?.({
        index: index + 1,
        total,
        localRef: item.local_ref,
        status: 'FAILED',
        error: message,
      });

      return {
        filename,
        projectKey: options.projectKey,
        status: 'PARTIAL',
        plan,
        created,
        skipped,
        failures,
        duplicates: report.duplicates,
      };
    }
  }

  deps.migrations.setStatus(filename, 'SUCCESS');

  return {
    filename,
    projectKey: options.projectKey,
    status: 'SUCCESS',
    plan,
    created,
    skipped,
    failures,
    duplicates: report.duplicates,
  };
}

function orderItems(items: readonly MigrationItem[]): MigrationItem[] {
  const byRef = new Map(items.map((item) => [item.local_ref, item]));
  const state = new Map<string, 'visiting' | 'done'>();
  const ordered: MigrationItem[] = [];

  const visit = (item: MigrationItem): void => {
    if (state.get(item.local_ref) === 'done') {
      return;
    }
    if (state.get(item.local_ref) === 'visiting') {
      throw new SeiriError(
        `Ciclo de padres detectado en "${item.local_ref}".`,
        'VALIDATION'
      );
    }

    state.set(item.local_ref, 'visiting');
    const parent = item.parent ? byRef.get(item.parent) : undefined;
    if (parent) {
      visit(parent);
    }
    state.set(item.local_ref, 'done');
    ordered.push(item);
  };

  for (const item of items) {
    visit(item);
  }

  return ordered;
}

function resolveParentKey(
  item: MigrationItem,
  localRefs: Set<string>,
  done: Map<string, string>
): string | null {
  if (!item.parent) {
    return null;
  }

  if (!localRefs.has(item.parent)) {
    return item.parent;
  }

  const key = done.get(item.parent);
  if (!key) {
    throw new SeiriError(
      `No se pudo resolver el parent local "${item.parent}" de "${item.local_ref}".`,
      'APPLY'
    );
  }

  return key;
}

async function readCreatedIssue(
  gateway: JiraGateway,
  key: string,
  context: {
    item: MigrationItem;
    projectKey: string;
    parentKey: string | null;
    type?: IssueType;
  }
): Promise<Issue> {
  try {
    return await gateway.getIssue(key);
  } catch {
    return {
      key,
      projectKey: context.projectKey,
      parentKey: context.parentKey,
      summary: context.item.summary,
      description: context.item.description ?? '',
      issueType: context.item.type,
      hierarchyLevel: context.type?.hierarchyLevel ?? 0,
      status: 'Unknown',
      priority: context.item.priority ?? null,
      storyPoints: context.item.story_points ?? null,
      jiraCreatedAt: null,
      jiraUpdatedAt: null,
    };
  }
}

function summarizeErrors(report: ValidationReport): string {
  const lines = report.errors
    .slice(0, 5)
    .map((error) => `- ${error.ref ? `[${error.ref}] ` : ''}${error.message}`);
  const rest = report.errors.length - lines.length;
  if (rest > 0) {
    lines.push(`- y ${rest} error(es) mas`);
  }

  return lines.join('\n');
}

function summarizeDuplicates(report: ValidationReport): string {
  return report.duplicates
    .slice(0, 5)
    .map((duplicate) => {
      const target = duplicate.source === 'existing'
        ? `${duplicate.key} "${duplicate.summary}"`
        : `local_ref "${duplicate.otherRef}"`;
      return `- [${duplicate.ref}] ${duplicate.score}% vs ${target}`;
    })
    .join('\n');
}

function baseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
