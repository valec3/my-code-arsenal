---
name: jira-issue-writing
description: >
  Write and review Jira issue content (Epics, Stories, Tasks, Bugs, Sub-tasks)
  with clear titles, context, scope, and testable acceptance criteria.
  Trigger: When drafting or rewriting an issue, épica/epica, historia de usuario,
  tarea, bug, criterios de aceptación/aceptacion, or backlog text for jira-seiri.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Drafting or rewriting a Jira title, description, or acceptance criteria
- User says "crear épica", "redactar historia", "agregar tarea", "criterios de aceptación"
- Reviewing an issue before it becomes a `migrations/*.json` item
- Deciding whether text is a Story, Task, Epic, Bug, or Sub-task

## Core Rules

1. **One issue = one outcome.** If you need "and" in the title, split it.
2. **Title = result, not activity.** "Usuario restablece contraseña" beats "Implementar reset".
3. **Description answers five questions:** context, scope, out of scope, acceptance criteria, technical notes.
4. **Acceptance criteria are testable.** 3-5 bullets, observable behavior, including error paths.
5. **Story = user value. Task = technical step. Epic = outcome across sprints. Bug = broken behavior with repro.**
6. **Spanish for summary/description** (neutral Rioplatense). Keep keys, endpoints, code, and field names in English and in backticks.
7. **Never invent** priority, story points, dates, Jira keys, or assignees. Omit them and list the assumption.
8. **Use proper Spanish accents** (á, é, í, ó, ú, ñ): "contraseña", "autenticación", "criterios de aceptación".

## Title Formulas

| Type | Formula | Example |
|---|---|---|
| Epic | `ÉPICA: <dominio> - <resultado>` | `ÉPICA: Autenticación - Acceso seguro con email` |
| Story | `HU: <rol> puede <acción> para <beneficio>` | `HU: Usuario restablece su contraseña por email` |
| Task | `[BACKEND] <acción técnica>` | `[BACKEND] Endpoint POST /auth/reset` |
| Bug | `[BUG] <síntoma> en <lugar>` | `[BUG] El reset devuelve 500 con emails largos` |
| Sub-task | `[<área>] <paso>` | `[DB] Migración tabla password_resets` |

Prefixes (`ÉPICA:`, `HU:`, `[BACKEND]`) follow the existing node-jira-bot convention. Keep them unless the team changes the convention.

## Story Description Template

```md
## Contexto
<qué pasa hoy y por qué importa>

## Alcance
- ...

## Fuera de alcance
- ...

## Criterios de aceptación
- [ ] Dado <contexto>, cuando <acción>, entonces <resultado observable>.
- [ ] ...

## Notas técnicas
- ...
```

## Acceptance Criteria

- Use `Dado / Cuando / Entonces` (Gherkin-lite), one behavior per bullet.
- Cover the happy path, at least one error path, and one edge case.
- Never write "funciona correctamente" or "es rápido" without a metric.
- Do not put implementation details in a Story; move them to a Task or "Notas técnicas".

Bad: `- [ ] El reset funciona.`
Good: `- [ ] Dado un email registrado, cuando pide reset, entonces recibe un mail con un link válido por 30 minutos.`

## INVEST Checklist

- **I**ndependent: can ship without waiting for another Story.
- **N**egotiable: describes the outcome, not a rigid solution.
- **V**aluable: a user or the business gets something.
- **E**stimable: the team can size it.
- **S**mall: fits in a sprint; otherwise split.
- **T**estable: acceptance criteria can be verified.

## Anti-Patterns

| Bad | Why | Better |
|---|---|---|
| `Implementar login` | activity, no outcome | `HU: Usuario inicia sesión con email y contraseña` |
| `Mejorar performance` | no metric | `HU: El listado carga en menos de 2 s con 10k filas` |
| `Arreglar bug` | no reproduction | `[BUG] El total muestra NaN al aplicar un cupón del 100%` |
| `Varios fixes` | multiple outcomes | split into separate issues |
| `Ver lo de auth` | not actionable | `[BACKEND] Validar expiración del token en /me` |

## Definition of Ready

An issue is ready when:

- [ ] The outcome is clear and valuable.
- [ ] Acceptance criteria are written and testable.
- [ ] Dependencies and parent are known.
- [ ] It is small enough to size.
- [ ] No open product questions remain.

## Example Cascade

```text
ÉPICA: Autenticación - Acceso seguro con email
└── HU: Usuario restablece su contraseña por email
    ├── [BACKEND] Endpoint POST /auth/reset
    ├── [FRONTEND] Formulario de solicitud de reset
    └── [DB] Tabla password_resets con expiración
```

## Resources

- **Story template**: [assets/story-template.md](assets/story-template.md)
