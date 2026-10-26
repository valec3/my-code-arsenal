import { z } from 'zod';
import { SeiriError } from '../domain/errors';
import { MIGRATION_VERSION, type MigrationFile } from '../domain/migration';

const PROJECT_PATTERN = /^[a-z][a-z0-9-]*$/;
const LOCAL_REF_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const LABEL_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const itemSchema = z
  .object({
    local_ref: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(LOCAL_REF_PATTERN, 'usa lowercase-hyphen: a-z, 0-9 y guiones'),
    action: z.string().refine((value) => value === 'CREATE', {
      message: 'el contrato v1 solo admite action "CREATE"',
    }),
    type: z.string().trim().min(1).max(64),
    summary: z.string().trim().min(1).max(255),
    description: z.string().max(32767).optional(),
    parent: z.string().trim().min(1).max(64).optional(),
    priority: z.string().trim().min(1).max(32).optional(),
    story_points: z.number().finite().nonnegative().optional(),
    labels: z.array(z.string().trim().regex(LABEL_PATTERN)).max(20).optional(),
  })
  .strict();

const fileSchema = z
  .object({
    version: z.literal(MIGRATION_VERSION).optional(),
    project: z
      .string()
      .trim()
      .regex(PROJECT_PATTERN, 'debe ser la carpeta del proyecto en kebab-case'),
    description: z.string().max(500).optional(),
    source: z.string().max(500).optional(),
    items: z.array(itemSchema).min(1).max(50),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      if (seen.has(item.local_ref)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'local_ref'],
          message: `local_ref duplicado en el archivo: "${item.local_ref}"`,
        });
      }
      seen.add(item.local_ref);
    });
  });

export function parseMigration(raw: unknown): MigrationFile {
  const result = fileSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(raiz)';
      return `  - ${path}: ${issue.message}`;
    });

    throw new SeiriError(
      `La migracion no respeta el contrato v${MIGRATION_VERSION}:`,
      'VALIDATION',
      `\n${details.join('\n')}\nRevisa .opencode/skills/seiri-migrations/SKILL.md`
    );
  }

  const data = result.data;

  return {
    version: MIGRATION_VERSION,
    project: data.project,
    description: data.description,
    source: data.source,
    items: data.items.map((item) => ({
      local_ref: item.local_ref,
      action: 'CREATE',
      type: item.type,
      summary: item.summary,
      description: item.description,
      parent: item.parent,
      priority: item.priority,
      story_points: item.story_points,
      labels: item.labels,
    })),
  };
}
