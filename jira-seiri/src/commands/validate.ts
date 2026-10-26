import path from 'node:path';
import type { Command } from 'commander';
import { validateMigration, type ValidationReport } from '../application/validate-migration';
import { closeDatabase } from '../infrastructure/db/connection';
import { SqliteIssueStore } from '../infrastructure/db/issue-store';
import { EXIT } from '../shared/exit-codes';
import { log } from '../shared/logger';
import { parseThreshold } from '../shared/parse';
import { loadMigrationFile } from './load-migration';
import { openProjectDatabase } from './project-db';

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
      const loaded = loadMigrationFile(file);
      const { db } = openProjectDatabase(loaded.migration.project);

      try {
        const report = validateMigration(
          { store: new SqliteIssueStore(db) },
          loaded.migration,
          { file: loaded.path, threshold }
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

  log.success('Validacion limpia. Listo para seiri apply.');
}
