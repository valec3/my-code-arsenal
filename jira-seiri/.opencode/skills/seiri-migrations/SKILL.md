---
name: seiri-migrations
description: >
  Author seiri migration JSON files from a pulled Jira context, with correct
  local_ref, parent resolution, and duplicate checks.
  Trigger: When writing or editing migrations/*.json, preparing a seiri
  migration, using .jira_context.md, or running seiri validate/apply.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Converting requirements into `migrations/*.json`
- Reading `projects/<proyecto>/.jira_context.md` before drafting
- Resolving `parent` between new and existing issues
- Running `seiri validate` or preparing `seiri apply`
- Checking whether an issue already exists in the local cache

## Workflow

1. Refresh context: `npm run seiri -- pull <proyecto>`.
2. Read `projects/<proyecto>/.jira_context.md`.
3. Draft each item with `jira-issue-writing` and `jira-hierarchy`.
4. Check for duplicates against existing keys and summaries in the context.
5. Write `migrations/YYYY-MM-DD_<slug>.json`.
6. Run `npm run seiri -- validate migrations/<archivo>.json`.
7. Run `apply` only after the user explicitly approves.

## Contract v1

```json
{
  "project": "endogastro",
  "description": "Backlog inicial de autenticación",
  "source": "reunión 2026-10-24",
  "items": [
    {
      "local_ref": "auth-reset",
      "action": "CREATE",
      "type": "Story",
      "summary": "HU: Usuario restablece su contraseña por email",
      "description": "## Contexto\n...\n\n## Criterios de aceptación\n- [ ] ...",
      "parent": "ENG-120",
      "priority": "High",
      "story_points": 5,
      "labels": ["auth"]
    }
  ]
}
```

| Field | Required | Rules |
|---|---|---|
| `project` | yes | Must match the project folder/key |
| `description` | no | What this migration changes |
| `source` | no | Meeting, doc, or request that originated it |
| `items` | yes | 1-50 items, one coherent change set |
| `items[].local_ref` | yes | Unique in the file, lowercase-hyphen, stable |
| `items[].action` | yes | `CREATE` in v1 |
| `items[].type` | yes | Exact issue type name from `createmeta` |
| `items[].summary` | yes | Follows `jira-issue-writing` |
| `items[].description` | no | Markdown; include context and acceptance criteria |
| `items[].parent` | no | Jira key (`ENG-123`) or `local_ref` from this file |
| `items[].priority` | no | Exact priority name from Jira; omit if unknown |
| `items[].story_points` | no | Number; omit for Epics |
| `items[].labels` | no | `string[]`, lowercase-hyphen |

`UPDATE` and `LINK` are reserved for a future contract version. Do not use them in v1.

## Rules

- One file = one coherent change set (one Epic or one theme). Do not mix unrelated work.
- `local_ref` is the stable identity of the item; do not rename it after the file is applied.
- Prefer real Jira keys from the context for `parent`. Use `local_ref` only for an item created in the same file.
- Never invent a Jira key. If the parent is unknown, omit it and list it as an open question.
- Reuse an existing key instead of creating a near-duplicate.
- Do not include tokens, secrets, personal data, or URLs with credentials.
- Spanish summaries and descriptions; English for code, endpoints, and field names.
- File name: `YYYY-MM-DD_<slug>.json`, lowercase-hyphen slug.

## Duplicate Check

Before writing an item:

1. Search the context for the same outcome, not just the same words.
2. If a similar issue exists, reuse its key or propose an update instead of a new item.
3. If the CLI reports exit code `3`, treat it as blocking: resolve the duplicate or explicitly justify it.

## Exit Codes

| Exit | Meaning | What to do |
|---|---|---|
| `0` | Clean, or already applied with the same checksum | Ready |
| `2` | Contract, hierarchy, parent, or checksum mismatch | Fix the JSON or create a new file |
| `3` | Possible duplicates above `--threshold` | Reuse the existing key or raise the threshold |
| `4` | Partial apply | Fix the error and rerun: it resumes from the failed item |

## Commands

```bash
npm run seiri -- pull endogastro
npm run seiri -- validate migrations/2026-10-24_auth.json
npm run seiri -- validate migrations/2026-10-24_auth.json --threshold 90
npm run seiri -- validate migrations/2026-10-24_auth.json --json
npm run seiri -- apply migrations/2026-10-24_auth.json --dry-run
npm run seiri -- apply migrations/2026-10-24_auth.json
```

`validate` never touches the network. `apply --dry-run` shows the plan without network or writes. `apply` revalidates internally and refuses to run with duplicate warnings unless `--allow-duplicates` is passed; run it only with explicit human approval.

## Resources

- **Example migration**: [assets/migration.example.json](assets/migration.example.json)
