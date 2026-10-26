import type { Issue, IssueType } from '../../domain/issue';
import { normalizeText } from '../../domain/similarity';
import type { IssueStore, ProjectSnapshot, SimilarIssue } from '../../ports/issue-store';
import type { Db } from './connection';

interface IssueRow {
  key: string;
  project_key: string;
  parent_key: string | null;
  summary: string;
  description: string | null;
  issue_type: string;
  hierarchy_level: number;
  status: string;
  priority: string | null;
  story_points: number | null;
  jira_created_at: string | null;
  jira_updated_at: string | null;
}

interface IssueTypeRow {
  id: string;
  name: string;
  hierarchy_level: number;
  subtask: number;
}

interface SimilarRow {
  key: string;
  summary: string;
  status: string;
}

const ISSUE_COLUMNS = `key, project_key, parent_key, summary, description, issue_type,
                       hierarchy_level, status, priority, story_points,
                       jira_created_at, jira_updated_at`;

const UPSERT_ISSUE = `
  INSERT INTO issues (
    key, project_key, parent_key, summary, description, issue_type,
    hierarchy_level, status, priority, story_points,
    jira_created_at, jira_updated_at, synced_at
  ) VALUES (
    @key, @projectKey, @parentKey, @summary, @description, @issueType,
    @hierarchyLevel, @status, @priority, @storyPoints,
    @jiraCreatedAt, @jiraUpdatedAt, CURRENT_TIMESTAMP
  )
  ON CONFLICT(key) DO UPDATE SET
    project_key = excluded.project_key,
    parent_key = excluded.parent_key,
    summary = excluded.summary,
    description = excluded.description,
    issue_type = excluded.issue_type,
    hierarchy_level = excluded.hierarchy_level,
    status = excluded.status,
    priority = excluded.priority,
    story_points = excluded.story_points,
    jira_created_at = excluded.jira_created_at,
    jira_updated_at = excluded.jira_updated_at,
    synced_at = CURRENT_TIMESTAMP
`;

export class SqliteIssueStore implements IssueStore {
  constructor(private readonly db: Db) {}

  saveSnapshot(snapshot: ProjectSnapshot): void {
    const upsertIssue = this.db.prepare(UPSERT_ISSUE);

    const save = this.db.transaction((data: ProjectSnapshot) => {
      this.db
        .prepare(
          `INSERT INTO projects (key, name, synced_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET
             name = excluded.name,
             synced_at = CURRENT_TIMESTAMP`
        )
        .run(data.project.key, data.project.name);

      this.db.prepare('DELETE FROM issue_types WHERE project_key = ?').run(data.project.key);

      const insertType = this.db.prepare(
        `INSERT INTO issue_types (id, project_key, name, hierarchy_level, subtask)
         VALUES (?, ?, ?, ?, ?)`
      );
      for (const type of data.issueTypes) {
        insertType.run(
          type.id,
          data.project.key,
          type.name,
          type.hierarchyLevel,
          type.subtask ? 1 : 0
        );
      }

      for (const issue of data.issues) {
        upsertIssue.run(toIssueParams(issue));
      }
    });

    save(snapshot);
  }

  listIssues(projectKey: string): Issue[] {
    const rows = this.db
      .prepare(
        `SELECT ${ISSUE_COLUMNS}
           FROM issues
          WHERE project_key = ?
          ORDER BY jira_updated_at DESC`
      )
      .all(projectKey) as IssueRow[];

    return rows.map(mapRow);
  }

  countIssues(projectKey: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS count FROM issues WHERE project_key = ?')
      .get(projectKey) as { count: number };

    return row.count;
  }

  getIssue(key: string): Issue | null {
    const row = this.db
      .prepare(`SELECT ${ISSUE_COLUMNS} FROM issues WHERE key = ?`)
      .get(key) as IssueRow | undefined;

    return row ? mapRow(row) : null;
  }

  listIssueTypes(projectKey: string): IssueType[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, hierarchy_level, subtask
           FROM issue_types
          WHERE project_key = ?
          ORDER BY hierarchy_level DESC, name`
      )
      .all(projectKey) as IssueTypeRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      hierarchyLevel: row.hierarchy_level,
      subtask: row.subtask === 1,
    }));
  }

  searchSimilar(projectKey: string, text: string, limit = 10): SimilarIssue[] {
    const match = buildFtsQuery(text);
    if (!match) {
      return [];
    }

    try {
      const rows = this.db
        .prepare(
          `SELECT i.key, i.summary, i.status
             FROM issues_fts
             JOIN issues i ON i.rowid = issues_fts.rowid
            WHERE issues_fts MATCH @match
              AND i.project_key = @projectKey
            ORDER BY rank
            LIMIT @limit`
        )
        .all({ match, projectKey, limit }) as SimilarRow[];

      return rows.map((row) => ({ key: row.key, summary: row.summary, status: row.status }));
    } catch {
      return [];
    }
  }

  listProjectKeys(): string[] {
    const rows = this.db.prepare('SELECT key FROM projects ORDER BY key').all() as Array<{
      key: string;
    }>;

    return rows.map((row) => row.key);
  }
}

export function buildFtsQuery(text: string, maxTokens = 12): string {
  const tokens = normalizeText(text)
    .split(' ')
    .filter((token) => token.length >= 3);

  const unique = [...new Set(tokens)].slice(0, maxTokens);
  return unique.map((token) => `${token}*`).join(' OR ');
}

function toIssueParams(issue: Issue): Record<string, unknown> {
  return {
    key: issue.key,
    projectKey: issue.projectKey,
    parentKey: issue.parentKey,
    summary: issue.summary,
    description: issue.description,
    issueType: issue.issueType,
    hierarchyLevel: issue.hierarchyLevel,
    status: issue.status,
    priority: issue.priority,
    storyPoints: issue.storyPoints,
    jiraCreatedAt: issue.jiraCreatedAt,
    jiraUpdatedAt: issue.jiraUpdatedAt,
  };
}

function mapRow(row: IssueRow): Issue {
  return {
    key: row.key,
    projectKey: row.project_key,
    parentKey: row.parent_key,
    summary: row.summary,
    description: row.description ?? '',
    issueType: row.issue_type,
    hierarchyLevel: row.hierarchy_level,
    status: row.status,
    priority: row.priority,
    storyPoints: row.story_points,
    jiraCreatedAt: row.jira_created_at,
    jiraUpdatedAt: row.jira_updated_at,
  };
}
