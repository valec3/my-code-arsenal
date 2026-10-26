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
5. No ejecutes `apply` sin aprobación explícita del humano.
6. Español rioplatense para issues; inglés para código, endpoints y nombres de campos.
7. Si falta contexto, preguntá. No rellenes huecos con suposiciones silenciosas.

## Comandos

```bash
npm run seiri -- init <proyecto>
npm run seiri -- pull <proyecto>
npm run seiri -- validate migrations/<archivo>.json   # disponible
npm run seiri -- apply migrations/<archivo>.json      # fase 5
```

`init`, `pull` y `validate` están disponibles. `apply` se habilita en la fase 5.

`validate` sale con `0` si está limpio, `2` ante errores de contrato/jerarquía/parent y `3` si detecta duplicados posibles. Nunca toca la red.

## Portabilidad

- `AGENTS.md` es el punto de entrada para cualquier agente.
- Las skills son archivos Markdown estándar; no dependen de opencode.
- Los agentes de `.opencode/agent/` son específicos de opencode; para otros frameworks, usá el prompt como guía.
