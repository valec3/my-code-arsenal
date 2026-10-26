import type {
  MigrationItemRecord,
  MigrationItemStatus,
  MigrationRecord,
  MigrationStatus,
  MigrationStore,
  NewMigration,
  NewMigrationItem,
} from '../../ports/migration-store';
import type { Db } from './connection';

interface MigrationRow {
  filename: string;
  description: string | null;
  version: number;
  checksum: string;
  status: MigrationStatus;
  applied_at: string | null;
}

interface ItemRow {
  operation_index: number;
  local_ref: string | null;
  action: string;
  issue_type: string | null;
  parent_key: string | null;
  summary: string;
  status: MigrationItemStatus;
  issue_key: string | null;
  error: string | null;
}

export class SqliteMigrationStore implements MigrationStore {
  constructor(private readonly db: Db) {}

  get(filename: string): MigrationRecord | null {
    const row = this.db
      .prepare(
        `SELECT filename, description, version, checksum, status, applied_at
           FROM migrations
          WHERE filename = ?`
      )
      .get(filename) as MigrationRow | undefined;

    if (!row) {
      return null;
    }

    return {
      filename: row.filename,
      description: row.description,
      version: row.version,
      checksum: row.checksum,
      status: row.status,
      appliedAt: row.applied_at,
    };
  }

  save(migration: NewMigration): void {
    this.db
      .prepare(
        `INSERT INTO migrations (filename, description, version, checksum, status)
         VALUES (@filename, @description, @version, @checksum, @status)`
      )
      .run(migration);
  }

  setStatus(filename: string, status: MigrationStatus): void {
    this.db
      .prepare(
        `UPDATE migrations
            SET status = @status,
                applied_at = CASE WHEN @status = 'SUCCESS' THEN CURRENT_TIMESTAMP ELSE applied_at END
          WHERE filename = @filename`
      )
      .run({ filename, status });
  }

  listItems(filename: string): MigrationItemRecord[] {
    const rows = this.db
      .prepare(
        `SELECT operation_index, local_ref, action, issue_type, parent_key,
                summary, status, issue_key, error
           FROM migration_items
          WHERE migration_filename = ?
          ORDER BY operation_index`
      )
      .all(filename) as ItemRow[];

    return rows.map((row) => ({
      operationIndex: row.operation_index,
      localRef: row.local_ref,
      action: row.action,
      issueType: row.issue_type,
      parentKey: row.parent_key,
      summary: row.summary,
      status: row.status,
      issueKey: row.issue_key,
      error: row.error,
    }));
  }

  saveItem(item: NewMigrationItem): void {
    this.db
      .prepare(
        `INSERT INTO migration_items (
           migration_filename, operation_index, local_ref, action, issue_type,
           parent_key, summary, status, issue_key, error, executed_at
         ) VALUES (
           @filename, @operationIndex, @localRef, @action, @issueType,
           @parentKey, @summary, @status, @issueKey, @error, CURRENT_TIMESTAMP
         )
         ON CONFLICT(migration_filename, operation_index) DO UPDATE SET
           local_ref = excluded.local_ref,
           action = excluded.action,
           issue_type = excluded.issue_type,
           parent_key = excluded.parent_key,
           summary = excluded.summary,
           status = excluded.status,
           issue_key = excluded.issue_key,
           error = excluded.error,
           executed_at = CURRENT_TIMESTAMP`
      )
      .run({
        filename: item.filename,
        operationIndex: item.operationIndex,
        localRef: item.localRef,
        action: item.action,
        issueType: item.issueType,
        parentKey: item.parentKey,
        summary: item.summary,
        status: item.status,
        issueKey: item.issueKey ?? null,
        error: item.error ?? null,
      });
  }
}
