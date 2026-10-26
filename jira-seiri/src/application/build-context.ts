import type { Issue, IssueType } from '../domain/issue';

export interface ContextOptions {
  project: string;
  projectKey: string;
  host: string;
  days: number;
  maxIssues: number;
  jql?: string;
  generatedAt?: Date;
}

export function buildContext(
  issues: readonly Issue[],
  issueTypes: readonly IssueType[],
  options: ContextOptions
): string {
  const sorted = [...issues].sort(compareUpdatedDesc);
  const limit = Math.max(0, options.maxIssues);
  const selected = sorted.slice(0, limit);
  const omitted = sorted.length - selected.length;

  const selectedKeys = new Set(selected.map((issue) => issue.key));
  const children = new Map<string | null, Issue[]>();

  for (const issue of selected) {
    const parent =
      issue.parentKey && selectedKeys.has(issue.parentKey) ? issue.parentKey : null;
    const bucket = children.get(parent) ?? [];
    bucket.push(issue);
    children.set(parent, bucket);
  }
  for (const bucket of children.values()) {
    bucket.sort(compareLevelThenUpdated);
  }

  const generatedAt = options.generatedAt ?? new Date();
  const window = options.jql
    ? `JQL: \`${options.jql}\``
    : `Ventana: ultimos ${options.days} dias`;

  const lines: string[] = [
    `# Contexto Jira — ${options.projectKey}`,
    '',
    `Proyecto local: \`${options.project}\` · Host: ${options.host}`,
    `Generado: ${generatedAt.toISOString()} · ${window}`,
    `Issues locales: ${sorted.length}${omitted > 0 ? ` (mostrando ${selected.length})` : ''}`,
    '',
  ];

  if (omitted > 0) {
    lines.push(
      `> Contexto truncado: se muestran ${selected.length} de ${sorted.length} issues, los mas recientes. Ajusta con --max-issues.`,
      ''
    );
  }

  lines.push('## Jerarquia local', '');
  const visited = new Set<string>();
  const roots = children.get(null) ?? [];

  if (roots.length === 0 && selected.length === 0) {
    lines.push('_Sin issues sincronizados._');
  }
  for (const root of roots) {
    renderIssue(root, 0, children, visited, lines);
  }
  for (const issue of selected) {
    if (!visited.has(issue.key)) {
      renderIssue(issue, 0, children, visited, lines);
    }
  }

  lines.push('', '## Tipos de issue disponibles', '');
  if (issueTypes.length === 0) {
    lines.push('_No sincronizados. Corre seiri pull._');
  } else {
    const ordered = [...issueTypes].sort(
      (a, b) => b.hierarchyLevel - a.hierarchyLevel || a.name.localeCompare(b.name)
    );
    for (const type of ordered) {
      const marker = type.subtask ? ' (subtask)' : '';
      lines.push(`- ${type.name} — hierarchyLevel ${type.hierarchyLevel}${marker}`);
    }
  }

  lines.push(
    '',
    '## Reglas para el agente',
    '',
    '- Antes de crear, busca el summary en este contexto. Si ya existe, cita la key en vez de duplicar.',
    '- Respeta hierarchyLevel: un subtask necesita un padre de nivel base; un Epic va sin padre.',
    '- No inventes keys ni tipos: usa solo los listados arriba.',
    ''
  );

  return lines.join('\n');
}

function renderIssue(
  issue: Issue,
  depth: number,
  children: Map<string | null, Issue[]>,
  visited: Set<string>,
  lines: string[]
): void {
  if (visited.has(issue.key)) {
    return;
  }
  visited.add(issue.key);

  const indent = '  '.repeat(depth);
  const priority = issue.priority ? `, ${issue.priority}` : '';
  lines.push(
    `${indent}- [${issue.key}] (${issue.issueType}, ${issue.status}${priority}) ${issue.summary}`
  );

  for (const child of children.get(issue.key) ?? []) {
    renderIssue(child, depth + 1, children, visited, lines);
  }
}

function compareUpdatedDesc(a: Issue, b: Issue): number {
  return (b.jiraUpdatedAt ?? '').localeCompare(a.jiraUpdatedAt ?? '');
}

function compareLevelThenUpdated(a: Issue, b: Issue): number {
  return b.hierarchyLevel - a.hierarchyLevel || compareUpdatedDesc(a, b);
}
