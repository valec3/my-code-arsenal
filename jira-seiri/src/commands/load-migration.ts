import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseMigration } from '../application/migration-schema';
import { SeiriError } from '../domain/errors';
import type { MigrationFile } from '../domain/migration';

export interface LoadedMigration {
  path: string;
  filename: string;
  checksum: string;
  migration: MigrationFile;
}

export function loadMigrationFile(file: string): LoadedMigration {
  const filePath = path.resolve(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    throw new SeiriError(`No existe el archivo ${filePath}`, 'CONFIG');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new SeiriError(
      `JSON invalido en ${path.basename(filePath)}: ${messageOf(error)}`,
      'VALIDATION'
    );
  }

  return {
    path: filePath,
    filename: path.basename(filePath),
    checksum: createHash('sha256').update(raw).digest('hex'),
    migration: parseMigration(data),
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
