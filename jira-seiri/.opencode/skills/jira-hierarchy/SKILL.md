---
name: jira-hierarchy
description: >
  Decide the correct Jira issue type and parent (Epic, Story, Task, Bug,
  Sub-task), split work into vertical slices, and assign story points.
  Trigger: When choosing between épica/epica, historia, tarea, bug o sub-task,
  defining parent/hierarchy, splitting a story, or estimating story points.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Choosing the issue type for a new item
- Deciding whether work is a Story, Task, or Sub-task
- Setting `parent` in a `migrations/*.json`
- Splitting a Story that is too big
- Assigning story points

## Decision Tree

```text
¿Es un resultado grande que cruza varios sprints?
  sí → Epic
  no ↓
¿Es comportamiento visible para el usuario o el negocio?
  sí → Story
  no ↓
¿Es un paso técnico necesario para entregar una Story?
  sí → Task
  no ↓
¿Es una parte de una Task que necesita seguimiento propio?
  sí → Sub-task
  no ↓
¿Es comportamiento roto?
  sí → Bug
```

## Parent Rules

- Read the real hierarchy from `projects/<proyecto>/.jira_context.md` (`issue_types`). Never hardcode levels.
- Native Jira cascade: **Epic → Story/Task → Sub-task**. A standard `Task` never hangs from a `Story`: if you need to break down a Story, use a `Sub-task`.
- Technical work that is not a user outcome can be a `Task` directly under the Epic.
- Use `Sub-task` only if the project exposes it in `createmeta` and the team already uses it.
- A child's parent must have a higher `hierarchyLevel` than the child; confirm with `seiri validate`.
- Epics have no parent unless the project defines a higher level (for example `Initiative`).
- Orphan Stories are allowed only for spikes or independent work; otherwise attach them to an Epic.

## Splitting Rules

- More than 5 acceptance criteria or more than 8 story points → split.
- Split **vertically**: each Story delivers end-to-end value (UI + API + DB if needed).
- Do not split by layer (all DB tasks, all API tasks, all UI tasks) unless the team explicitly works that way.
- A Task is an implementation step, not a user outcome.
- Keep each Story independently deployable when possible.

## Story Points

| Points | Meaning |
|---|---|
| 1 | trivial, well understood |
| 2 | small, low uncertainty |
| 3 | normal, some detail |
| 5 | moderate, multiple moving parts |
| 8 | large, needs care |
| 13 | very large; split before estimating |

- Points measure complexity and uncertainty, **not hours**.
- Do not estimate Epics.
- Tasks are optional to estimate; Sub-tasks usually are not estimated.
- If the team uses a different scale, use the team's scale.

## Links vs Parent

| Need | Use |
|---|---|
| Containment (Epic/Story/Task) | `parent` |
| Dependency | link type `Blocks` / `Is blocked by` |
| Relation | link type `Relates to` |
| Duplicate | link type `Duplicates` / `Is duplicated by` |

Do not encode dependencies only in the description. If a dependency is real, create a link.

## Labels and Components

- `component`: stable area of the product (`auth`, `billing`, `onboarding`).
- `label`: cross-cutting attribute (`tech-debt`, `spike`, `security`).
- Use lowercase and hyphens. Do not invent synonyms for existing values.

## Anti-Patterns

| Anti-pattern | Why it hurts | Fix |
|---|---|---|
| Standard Task under a Story | Jira rejects it: only Sub-tasks can hang from a Story | use a Sub-task or move the Task under the Epic |
| Story with Sub-tasks when the team uses Tasks | inconsistent board | use standard Tasks under the Epic |
| `Varios` / `Misc` bucket | impossible to prioritize | split by outcome |
| Horizontal split (all DB first) | nothing shippable until the end | split vertically |
| Story with 12 acceptance criteria | too big to review | split into smaller Stories |
| Orphan Stories everywhere | no roadmap view | attach to an Epic or mark as spike |

## Example Tree

```text
ÉPICA: Autenticación - Acceso seguro con email
├── HU: Usuario restablece su contraseña por email
│   ├── SUB-TAREA: [BACKEND] Endpoint POST /auth/reset
│   ├── SUB-TAREA: [FRONTEND] Formulario de solicitud de reset
│   └── SUB-TAREA: [DB] Tabla password_resets con expiración
└── HU: Usuario verifica su email al registrarse
    ├── SUB-TAREA: [BACKEND] Endpoint POST /auth/verify
    └── SUB-TAREA: [FRONTEND] Pantalla de verificación pendiente
```

Children of a Story are `Sub-task`. A cross-cutting technical `Task` hangs from the Epic, not from a Story.
