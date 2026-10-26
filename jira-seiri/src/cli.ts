#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { registerInitCommand } from './commands/init';
import { registerPullCommand } from './commands/pull';
import { registerValidateCommand } from './commands/validate';
import { registerApplyCommand } from './commands/apply';
import { SeiriError } from './domain/errors';
import { EXIT, exitCodeFor } from './shared/exit-codes';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('seiri')
  .description('Sincronizacion declarativa entre Jira Cloud y SQLite local')
  .version(VERSION);

registerInitCommand(program);
registerPullCommand(program);
registerValidateCommand(program);
registerApplyCommand(program);

program.addHelpText(
  'after',
  `
${pc.bold('Flujo de trabajo:')}
  1. seiri init <proyecto>       crea projects/<proyecto>/ y la base local
  2. seiri pull <proyecto>       Jira -> SQLite + .jira_context.md
  3. (el agente escribe)         migrations/YYYY-MM-DD_descripcion.json
  4. seiri validate <archivo>    chequeos locales, sin red
  5. seiri apply <archivo>       Jira -> SQLite (idempotente)

Seiri nunca crea nada sin un archivo de migracion revisado.
`
);

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof SeiriError) {
    console.error(`${pc.red('[error]')} ${error.message}`);
    if (error.hint) {
      console.error(pc.dim(`        ${error.hint}`));
    }
    process.exit(exitCodeFor(error.code));
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`${pc.red('[error]')} ${message}`);
  process.exit(EXIT.UNEXPECTED);
});
