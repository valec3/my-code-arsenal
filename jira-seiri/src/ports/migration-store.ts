export type MigrationStatus = 'PENDING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';

export type MigrationItemStatus =
  | 'PENDING'
  | 'CREATED'
  | 'UPDATED'
  | 'LINKED'
  | 'SKIPPED_DUPLICATE'
  | 'FAILED';

export interface MigrationRecord {
  filename: string;
  description: string | null;
  version: number;
  checksum: string;
  status: MigrationStatus;
  appliedAt: string | null;
}

export interface MigrationItemRecord {
  operationIndex: number;
  localRef: string | null;
  action: string;
  issueType: string | null;
  parentKey: string | null;
  summary: string;
  status: MigrationItemStatus;
  issueKey: string | null;
  error: string | null;
}

export interface NewMigration {
  filename: string;
  description: string | null;
  version: number;
  checksum: string;
  status: MigrationStatus;
}

export interface NewMigrationItem {
  filename: string;
  operationIndex: number;
  localRef: string;
  action: string;
  issueType: string;
  parentKey: string | null;
  summary: string;
  status: MigrationItemStatus;
  issueKey?: string | null;
  error?: string | null;
}

export interface MigrationStore {
  get(filename: string): MigrationRecord | null;
  save(migration: NewMigration): void;
  setStatus(filename: string, status: MigrationStatus): void;
  listItems(filename: string): MigrationItemRecord[];
  saveItem(item: NewMigrationItem): void;
}
