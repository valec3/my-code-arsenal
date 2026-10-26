import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import pc from 'picocolors';
import { parseMigration } from '../application/migration-schema';
import { validateMigration, type ValidationReport } from '../application/validate-migration';
import { projectDbPath } from '../config/paths';
import { SeiriError } from '../domain/errors';
import { applySchema, closeDatabase, listTables, openDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { EXIT } from '../shared/exit-codes';
import { log } from '../shared/logger';

interface ValidateCommandOptions {
  threshold: string;
  json: boolean;
}

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .argument('<file>', 'archivo migrations/*.json')
    .description('Valida una migracion contra la base local, sin tocar la red')
    .option('--threshold <n>', 'similitud 0-100 para marcar duplicado', '80')
    .option('--json', 'salida JSON para agentes', false)
    .action((file: string, options: ValidateCommandOptions) => {
      const threshold = parseThreshold(options.threshold);
      const migrationPath = path.resolve(process.cwd(), file);

      const migration = parseMigration(readJson(migrationPath));
      const dbPath = projectDbPath(migration.project);

      if (!fs.existsSync(dbPath)) {
        throw new SeiriError(
          `No existe la base local del proyecto "${migration.project}".`,
          'CONFIG',
          `Corre seiri init ${migration.project} y despues seiri pull ${migration.project}.`
        );
      }

      const db = openDatabase(dbPath);
      try {
        const tables = listTables(db);
        if (!tables.includes('issues') || !tables.includes('issue_types')) {
          throw new SeiriError(
            `La base de "${migration.project}" no tiene el esquema de seiri.`,
            'CONFIG',
            `Corre seiri pull ${migration.project} para inicializarla.`
          );
        }
        applySchema(db);

        const report = validateMigration(
          { store: new SqliteIssueStore(db) },
          migration,
          { file: migrationPath, threshold }
        );

        const exitCode = report.errors.length > 0
          ? EXIT.VALIDATION
          : report.duplicates.length > 0
            ? EXIT.DUPLICATE
            : EXIT.OK;

        if (options.json) {
          console.log(JSON.stringify({ ...report, exitCode }, null, 2));
        } else {
          printReport(report);
        }

        process.exitCode = exitCode;
      } finally {
        closeDatabase(db);
      }
    });
}

function readJson(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new SeiriError(`No existe el archivo ${filePath}`, 'CONFIG');
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new SeiriError(
      `JSON invalido en ${path.basename(filePath)}: ${messageOf(error)}`,
      'VALIDATION'
    );
  }
}

function parseThreshold(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new SeiriError('--threshold debe ser un entero entre 0 y 100', 'VALIDATION');
  }

  return parsed;
}

function printReport(report: ValidationReport): void {
  log.title(`validate ${path.basename(report.file)}`);
  log.info(
    `Proyecto "${report.project}" -> ${report.projectKey ?? '?'} · ${report.itemCount} items · umbral ${report.threshold}%`
  );

  if (report.errors.length > 0) {
    log.title(`Errores (${report.errors.length})`);
    for (const error of report.errors) {
      const prefix = error.ref ? `[${error.ref}] ` : '';
      log.error(`${prefix}${error.message}`);
      if (error.hint) {
        log.detailError(error.hint);
      }
    }
  }

  if (report.duplicates.length > 0) {
    log.title(`Posibles duplicados (${report.duplicates.length})`);
    for (const duplicate of report.duplicates) {
      const target = duplicate.source === 'existing'
        ? `${duplicate.key} "${duplicate.summary}"${duplicate.status ? ` (${duplicate.status})` : ''}`
        : `local_ref "${duplicate.otherRef}" "${duplicate.summary}"`;
      log.warn(`[${duplicate.ref}] ${duplicate.score}% de similitud con ${target}`);
    }
    log.detail('Revisalos, reusa la key existente o subi --threshold si es intencional.');
  }

  log.plain('');
  if (report.errors.length > 0) {
    log.error('Validacion fallida: no apliques esta migracion todavia.');
    return;
  }
  if (report.duplicates.length > 0) {
    log.warn('Sin errores de contrato, pero hay duplicados posibles. Exit 3.');
    return;
  }

  log.success('Validacion limpia. Listo para seiri apply (fase 5).');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
