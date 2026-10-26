# jira-seiri — Guía para agentes

Este archivo aplica solo a `jira-seiri/`. Las reglas de aislamiento del monorepo están en [`../AGENT.md`](../AGENT.md).

## Cómo usarlo

Abrí opencode desde `jira-seiri/` para que cargue `.opencode/skills/`, `.opencode/agent/` y este archivo. Si ya estaba abierto, reinicialo.

## Flujo

```text
seiri pull  →  agente redacta  →  seiri validate  →  seiri apply
```

La IA **nunca** llama a la API de Jira. Lee el contexto local, escribe un JSON y el CLI lo aplica.

## Skills

| Skill | Cuándo cargarla |
|---|---|
| [`jira-issue-writing`](.opencode/skills/jira-issue-writing/SKILL.md) | Redactar o revisar títulos, descripciones y criterios de aceptación |
| [`jira-hierarchy`](.opencode/skills/jira-hierarchy/SKILL.md) | Elegir tipo, parent, split y story points |
| [`seiri-migrations`](.opencode/skills/seiri-migrations/SKILL.md) | Escribir `migrations/*.json` y usar el contrato v1 |

Las skills siguen el formato Agent Skills (`SKILL.md` + frontmatter). opencode las carga desde `.opencode/skills/`; para otros agentes, apuntá a esa ruta o copiala a `.claude/skills/`.

## Agentes

| Agente | Modo | Uso |
|---|---|---|
| `jira-author` | subagent | Redacta issues y escribe migraciones. Sin red, sin `apply`. |
| `jira-reviewer` | subagent | Revisa drafts en modo solo lectura. |

## Reglas

1. Leé `projects/<proyecto>/.jira_context.md` antes de escribir.
2. No inventes keys, prioridades, story points, fechas ni assignees.
3. No crees duplicados: buscá primero en el contexto.
4. Escribí solo en `migrations/`. No toques `src/`, `schema.sql` ni otros proyectos.
5. No ejecutes `apply`, `transition` ni `assign` sin aprobación explícita del humano.
6. Español rioplatense para issues; inglés para código, endpoints y nombres de campos.
7. Si falta contexto, preguntá. No rellenes huecos con suposiciones silenciosas.

## Comandos

```bash
npx tsx src/cli.ts init <proyecto>
npx tsx src/cli.ts pull <proyecto>
npx tsx src/cli.ts validate migrations/<archivo>.json
npx tsx src/cli.ts apply migrations/<archivo>.json --dry-run
npx tsx src/cli.ts apply migrations/<archivo>.json
npx tsx src/cli.ts transition <proyecto> <keys...> --to <estado> --dry-run
npx tsx src/cli.ts transition <proyecto> <keys...> --to <estado>
npx tsx src/cli.ts users <proyecto>
npx tsx src/cli.ts assign <proyecto> <accountId> <keys...> --dry-run
npx tsx src/cli.ts assign <proyecto> <accountId> <keys...>
```

`init`, `pull`, `validate`, `apply`, `transition`, `users` y `assign` están disponibles.

`validate` sale con `0` si está limpio, `2` ante errores de contrato/jerarquía/parent y `3` si detecta duplicados posibles. Nunca toca la red.

`apply` valida de nuevo antes de tocar Jira. Con `--dry-run` muestra el plan sin red ni escrituras. Sin `--allow-duplicates` aborta con exit `3` si hay duplicados, y si una corrida falla a mitad queda en `PARTIAL` (exit `4`) para retomarla sin recrear lo ya hecho.

`transition` mueve issues existentes usando las transiciones reales del workflow. `--dry-run` consulta Jira y muestra el plan sin escribir; si la issue ya está en el estado destino, la saltea.

`users` lista los usuarios asignables con su `accountId` (el email puede estar oculto). `assign` asigna issues por `accountId`; no resuelve nombres ni emails y no actualiza el cache local.

## Portabilidad

- `AGENTS.md` es el punto de entrada para cualquier agente.
- Las skills son archivos Markdown estándar; no dependen de opencode.
- Los agentes de `.opencode/agent/` son específicos de opencode; para otros frameworks, usá el prompt como guía.
