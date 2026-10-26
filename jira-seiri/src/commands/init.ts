import type { Command } from 'commander';
import { initProject } from '../application/init-project';
import { log } from '../shared/logger';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .argument('<project>', 'nombre del proyecto (kebab-case)')
    .description('Crea projects/<project>/ y aplica el esquema SQLite')
    .action((project: string) => {
      const result = initProject(project);

      log.title(`Proyecto seiri: ${result.project}`);
      log.success(`Base local lista: ${result.dbPath}`);
      log.info(`schema_version: ${result.schemaVersion}`);
      log.info(`tablas: ${result.tables.join(', ')}`);

      if (result.createdEnvExample) {
        log.warn('Creado .env.example; copialo a .env y completa JIRA_PROJECT_KEY.');
      } else {
        log.detail('.env.example ya existia, no se toco.');
      }
    });
}
