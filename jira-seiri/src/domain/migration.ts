export const MIGRATION_VERSION = 1 as const;

export type MigrationAction = 'CREATE';

export interface MigrationItem {
  local_ref: string;
  action: MigrationAction;
  type: string;
  summary: string;
  description?: string;
  parent?: string;
  priority?: string;
  story_points?: number;
  labels?: string[];
}

export interface MigrationFile {
  version: typeof MIGRATION_VERSION;
  project: string;
  description?: string;
  source?: string;
  items: MigrationItem[];
}
