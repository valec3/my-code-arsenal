---
name: jira-issues
description: >
  Create and validate Jira backlog entries (Epics, User Stories, Tasks) for the
  node-jira-bot hierarchical provisioner. Covers the JSON schema, field reference,
  priority values, and multi-project structure.
  Trigger: When creating or editing backlog.json, defining Jira issues (épicas,
  historias de usuario, tareas), or preparing a Jira project backlog for provisioning.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Creating or editing a `backlog.json` file for the node-jira-bot
- User asks to "crear épicas", "agregar historias", "definir tareas" for Jira
- User mentions `backlog.json`, "provisionar Jira", or "cascada de backlog"
- User wants to know what fields are available for each issue type
- User needs to validate their backlog structure before provisioning

## Critical Patterns

### 1. Hierarchy (MANDATORY — do NOT deviate)

```
Epic → Story → Task
```

- **Epic**: Top-level container. Has `stories[]`. Never has `tasks[]` directly.
- **Story** (Historia de Usuario): Child of Epic. Has `tasks[]`. Can have `storyPoints`.
- **Task**: Child of Story. Leaf node. Standard Jira "Task" type, **NOT** "Sub-task".

**NEVER nest tasks under epics directly.** The hierarchy is strict: Epic contains Stories, Stories contain Tasks.

### 2. Issue Types (Jira)

| JSON level | Jira issue type | Config variable | Default |
|---|---|---|---|
| Epic | Epic | `JIRA_EPIC_TYPE` | `Epic` |
| Story | Story | `JIRA_STORY_TYPE` | `Story` |
| Task | Task | `JIRA_TASK_TYPE` | `Task` |

**Task is NOT Sub-task.** The bot creates standard Jira Tasks linked to their parent Story via the `parent` field. If your Jira project uses a custom name for Tasks, set `JIRA_TASK_TYPE` in your project's `.env`.

### 3. Multi-Project Structure

Each project has its own folder under `projects/<name>/`:

```
projects/<name>/
  .env          # JIRA_PROJECT_KEY + optional custom issue type names
  backlog.json  # Epics, stories, tasks for this project
```

The root `.env` contains shared credentials (JIRA_HOST, JIRA_USER_EMAIL, JIRA_API_TOKEN). The project `.env` overrides/adds JIRA_PROJECT_KEY.

## Backlog JSON Schema

```typescript
// Root: array of epics
BacklogEpic[]  // The backlog.json file

// Epic
{
  summary: string;          // Required. Title of the epic.
  description?: string;     // Plain text. Becomes the epic description in Jira.
  priority?: string;        // See Priority Values below.
  stories?: BacklogStory[]; // Child stories. Omit or use [] if epic has no stories yet.
}

// Story (Historia de Usuario)
{
  summary: string;          // Required. Title of the story.
  description?: string;     // Plain text. Becomes the story description in Jira.
  priority?: string;        // See Priority Values below.
  storyPoints?: number;     // Story point estimate (1, 2, 3, 5, 8, 13, 21, etc.)
  tasks?: BacklogTask[];    // Child tasks. Omit or use [] if story has no tasks yet.
}

// Task
{
  summary: string;          // Required. Title of the task.
  description?: string;     // Plain text. Becomes the task description in Jira.
  priority?: string;        // See Priority Values below.
}
```

## Field Reference

| Field | Level | Required | Type | Example |
|---|---|---|---|---|
| `summary` | Epic, Story, Task | ✅ Yes | `string` | `"ÉPICA: Auth y Seguridad"` |
| `description` | Epic, Story, Task | No | `string` | `"Implementar flujo completo..."` |
| `priority` | Epic, Story, Task | No | `string` | `"Highest"`, `"High"`, `"Medium"`, `"Low"`, `"Lowest"` |
| `stories` | Epic | No | `BacklogStory[]` | `[{...}, {...}]` |
| `tasks` | Story | No | `BacklogTask[]` | `[{...}, {...}]` |
| `storyPoints` | Story | No | `number` | `5`, `8`, `13` |

## Priority Values

Use the **exact** Jira priority names for your instance. Common values:

| Priority | Use for |
|---|---|
| `"Highest"` | Critical path, MVP must-have, blockers |
| `"High"` | Important but not blocking |
| `"Medium"` | Standard priority |
| `"Low"` | Nice to have |
| `"Lowest"` | Backlog filler, future consideration |

**Verify your Jira instance's exact priority names.** Some instances use different labels (e.g., "Critical" instead of "Highest"). The bot passes these as-is to the Jira API.

## Naming Conventions

- **Epic summary**: Prefix with `ÉPICA:` or `EPIC:` → `"ÉPICA: Core - Carga de Archivos"`
- **Story summary**: Prefix with `HU:` or `US:` → `"HU: Registro con correo y contraseña"`
- **Task summary**: Prefix with `[BACKEND]`, `[FRONTEND]`, `[DB]`, `[DEVOPS]` → `"[BACKEND] Endpoint POST /api/auth/login"` or use `Tarea:` → `"Tarea: Diseñar formulario UI"`

These prefixes are conventions, not enforced by the bot. They help with readability in Jira.

## Commands

```bash
# Provision a specific project
pnpm run dev <project-name>

# Example
pnpm run dev cgs
pnpm run dev endogastro

# Purge the last created issues for a project
pnpm run purge <project-name>

# Purge specific issues
pnpm run purge <project-name> KEY-1 KEY-2

# Nuclear purge (all issues in the project)
pnpm run purge <project-name> --all
```

## Resources

- **Minimal template**: See [assets/backlog-minimal.json](assets/backlog-minimal.json) — one epic, one story, one task
- **Full example**: See [assets/backlog-full.json](assets/backlog-full.json) — multiple epics with stories and tasks
- **Multi-project guide**: See the project [README.md](../../README.md)
