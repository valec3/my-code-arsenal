# seiri (jira-seiri)

> 整理 — ordenar, clasificar. CLI de sincronización declarativa entre **Jira Cloud** y una **base SQLite local**, diseñada para que un agente de IA prepare migraciones de backlog sin tocar la API directamente.

## Qué problema resuelve

Crear tickets a mano en Jira es lento y propenso a duplicados. Este proyecto separa la captura verbal de la ejecución:

```text
Jira Cloud API
      │  seiri pull
      ▼
SQLite local (.jira_cache.db) + .jira_context.md
      │  el agente lee contexto y escribe
      ▼
migrations/YYYY-MM-DD_descripcion.json
      │  seiri validate  (sin red)
      ▼
seiri apply  →  Jira + SQLite
      │  seiri transition  (opcional)
      ▼
Estados del workflow actualizados
```

La IA **nunca** llama a la API de Jira. Solo genera un JSON que vos revisás en tu editor. El CLI valida jerarquía, detecta duplicados y aplica de forma idempotente.

## Estado

Fase 10 — `sprint-start`. Disponible: `seiri init`, `seiri pull`, `seiri validate`, `seiri apply`, `seiri transition`, `seiri users`, `seiri assign`, `seiri sprints`, `seiri sprint-create`, `seiri sprint-start` y `seiri sprint-move`.

- `pull` sincroniza proyecto, tipos de issue e issues a SQLite (upsert transaccional) y genera `.jira_context.md` con presupuesto de issues.
- `validate` revisa el contrato v1, la jerarquía real del proyecto (desde `createmeta`) y los duplicados por similitud, sin tocar la red.
- `apply` crea las issues en Jira, actualiza el cache local y registra la migración para que sea idempotente y retomable.
- `transition` mueve issues existentes a otro estado usando las transiciones del workflow, sin inventar IDs.
- `users` lista los usuarios asignables del proyecto y `assign` asigna issues existentes por `accountId`.
- `sprints` lista los boards con sprints y sus sprints; `sprint-create` crea un sprint futuro, `sprint-start` lo inicia y `sprint-move` mueve issues existentes a un sprint.

## Requisitos

- Node.js >= 22
- npm (no pnpm: el gestor está roto en el entorno de desarrollo actual)

## Instalación

```bash
cd jira-seiri
npm install
```

## Configurar credenciales

Son dos archivos, ambos ignorados por Git y ya creados en este repo:

1. `jira-seiri/.env` — credenciales compartidas. Reemplazá los valores:

   ```dotenv
   JIRA_HOST=https://tu-sitio.atlassian.net
   JIRA_USER_EMAIL=tu-email@empresa.com
   JIRA_API_TOKEN=tu_token
   ```

   El API token se genera en https://id.atlassian.com/manage-profile/security/api-tokens

2. `projects/endogastro/.env` — key del proyecto:

   ```dotenv
   JIRA_PROJECT_KEY=ENG
   ```

Si te olvidás de reemplazar un valor de ejemplo, `seiri` lo detecta y te dice exactamente qué variable falta.

Para crear otro proyecto: `npx tsx src/cli.ts init <nombre>` y después copiá `projects/<nombre>/.env.example` a `.env`.

## Uso

```bash
# crea projects/<nombre>/ con su .env.example y su base local (idempotente)
npx tsx src/cli.ts init endogastro

# Jira -> SQLite + projects/endogastro/.jira_context.md
npx tsx src/cli.ts pull endogastro

npx tsx src/cli.ts --help
npx tsx src/cli.ts --version
```

`init` es idempotente: se puede volver a correr sin destruir datos ni pisar `.env.example`.

> En Windows con npm 10, `npm run seiri -- ...` descarta los flags (`--days`, `--dry-run`, `--json`) sin avisar. Por eso todos los ejemplos usan `npx tsx src/cli.ts`.

### pull

Sincroniza Jira con la base local y escribe `projects/<nombre>/.jira_context.md`.

```bash
npx tsx src/cli.ts pull endogastro                  # ultimos 30 dias
npx tsx src/cli.ts pull endogastro --days 7
npx tsx src/cli.ts pull endogastro --jql 'project = ENG AND status != Done'
npx tsx src/cli.ts pull endogastro --max-issues 80
```

- El upsert es transaccional y no borra issues fuera de la ventana: el cache se va completando con cada pull.
- `.jira_context.md` se ordena por jerarquía y se limita a `--max-issues` (default 150) para no inflar el prompt del agente.
- Story points: configurá `JIRA_STORY_POINTS_FIELD` en el `.env` raíz; si no está, se omiten.

### validate

Valida una migración contra la base local antes de tocar Jira.

```bash
npx tsx src/cli.ts validate migrations/2026-10-24_auth.json
npx tsx src/cli.ts validate migrations/2026-10-24_auth.json --threshold 90
npx tsx src/cli.ts validate migrations/2026-10-24_auth.json --json
```

Qué comprueba:

1. Contrato v1 con zod (`items[]`, `local_ref` único, `action: CREATE`, límites de Jira).
2. `project` corresponde a una base local ya sincronizada.
3. El `type` existe en `issue_types` (createmeta), con sugerencias si hay un typo.
4. El `parent` existe en el cache o en el mismo archivo, sin ciclos.
5. La jerarquía real: un `Sub-task` necesita padre de nivel base, y un hijo no puede colgar de un nivel igual o menor.
6. Duplicados: recall con FTS5 + score con Dice de trigramas contra los summaries existentes y dentro del mismo archivo.

El umbral default es 80% y se ajusta con `--threshold`. `--json` devuelve el reporte completo con `exitCode` para agentes.

| Exit | Significado |
|---|---|
| `0` | Limpia: lista para `apply` |
| `2` | Error de contrato, jerarquía o parent: no aplicar |
| `3` | Duplicados posibles: reusar la key o subir el umbral |

### apply

Aplica la migración en Jira y actualiza el cache local. Vuelve a correr `validate` internamente antes de tocar la red.

```bash
npx tsx src/cli.ts apply migrations/2026-10-24_auth.json --dry-run   # plan, sin red ni escrituras
npx tsx src/cli.ts apply migrations/2026-10-24_auth.json             # aplica de verdad
npx tsx src/cli.ts apply migrations/2026-10-24_auth.json --allow-duplicates
```

Garantías:

- **Idempotente:** el nombre del archivo es la PK en `migrations`. Si ya está en `SUCCESS` con el mismo checksum (SHA-256), no hace nada.
- **Retomable:** si una corrida queda en `PARTIAL`, la siguiente saltea los items ya `CREATED` y sigue desde el fallido, reusando las keys reales como parent.
- **Sin duplicados silenciosos:** si `validate` encuentra duplicados, aborta con exit `3` salvo `--allow-duplicates`.
- **Credenciales tardías:** el `.env` se carga recién cuando hay algo para crear. `--dry-run` y los abortos de validación funcionan sin red ni credenciales.
- **Trazabilidad:** cada operación queda en `migration_items` con su `local_ref`, key creada, estado y error.
- **Cache al día:** cada issue creada se relee desde Jira y se upsertea en SQLite (con FTS5 actualizado por triggers).

| Exit | Significado |
|---|---|
| `0` | Aplicada, ya aplicada (skip) o dry-run |
| `2` | Contrato, jerarquía, parent o checksum distinto |
| `3` | Duplicados sin `--allow-duplicates` |
| `4` | Resultado parcial: corregí el error y volvé a correr |

### transition

Mueve issues existentes a otro estado. Jira no acepta el nombre del estado: hay que pedir las transiciones disponibles del issue y aplicar el ID. `--dry-run` hace ese GET y muestra el plan sin escribir.

```bash
npx tsx src/cli.ts transition endogastro ENG-337 ENG-338 --to Done --dry-run
npx tsx src/cli.ts transition endogastro ENG-337 ENG-338 --to Done
npx tsx src/cli.ts transition endogastro ENG-337 --to Done --json
```

Garantías:

- **Workflow real:** solo ofrece transiciones que Jira permite para esa issue y ese estado. Si no hay una transición directa a `Done`, lo reporta con las opciones disponibles.
- **Idempotente:** si la issue ya está en el estado destino, la saltea sin llamar a la API de transición.
- **Cache al día:** después de mover, relee la issue y actualiza SQLite.
- **Parcial:** si una falla, sigue con las demás y devuelve exit `4`; si todas fallan, exit `2`.

| Exit | Significado |
|---|---|
| `0` | Todas movidas, ya estaban o dry-run |
| `2` | Ninguna se pudo mover (workflow o keys inválidas) |
| `4` | Parcial: mover las que quedaron y volver a correr |

### users

Lista los usuarios asignables del proyecto con su `accountId`. Jira Cloud suele ocultar el email por privacidad; en ese caso se muestra `(email oculto)`.

```bash
npx tsx src/cli.ts users endogastro
npx tsx src/cli.ts users endogastro --json
```

Requiere el permiso **Browse users and groups**. Si la lista sale vacía, revisá ese permiso en Jira.

### assign

Asigna issues existentes a un usuario por `accountId`. No se asigna por email ni por nombre: el `accountId` es el identificador estable de Jira Cloud.

```bash
npx tsx src/cli.ts assign endogastro <accountId> ENG-346 ENG-347 --dry-run
npx tsx src/cli.ts assign endogastro <accountId> ENG-346 ENG-347
npx tsx src/cli.ts assign endogastro <accountId> ENG-346 --json
```

Garantías:

- **Sin inventos:** solo usa el `accountId` recibido; no resuelve nombres ni emails.
- **Parcial:** si una issue falla, sigue con las demás y devuelve exit `4`; si todas fallan, exit `2`.
- **Dry-run:** muestra el plan sin escribir en Jira.
- **Cache:** la asignación no se guarda en SQLite; `assign` no modifica el cache.

Requiere el permiso **Assign issues** sobre el proyecto.

| Exit | Significado |
|---|---|
| `0` | Todas asignadas o dry-run |
| `2` | Ninguna se pudo asignar |
| `4` | Parcial: asignar las que quedaron y volver a correr |

### sprints

Lista los boards con sprints del proyecto y sus sprints. Se aceptan boards `scrum` y `simple` (este último es el tipo que usa Jira para proyectos team-managed). Los boards Kanban no se consideran porque no usan sprints. Si hay más de un board válido, hay que elegir uno con `--board`.

```bash
npx tsx src/cli.ts sprints endogastro
npx tsx src/cli.ts sprints endogastro --board 7 --state active,future
npx tsx src/cli.ts sprints endogastro --json
```

Garantías:

- **Solo boards con sprints:** acepta `scrum` y `simple`; si el proyecto no tiene ninguno, falla con exit `1` y muestra los boards encontrados.
- **Sin escrituras:** es una consulta de solo lectura.
- **Estados:** `active`, `future` y `closed`; por defecto lista los tres.

Requiere Jira Software y permiso para ver el board.

| Exit | Significado |
|---|---|
| `0` | Listado OK (puede no haber sprints) |
| `1` | El proyecto no tiene board Scrum o falló la API |
| `2` | `--board` inválido o hay varios boards sin elegir |

### sprint-create

Crea un sprint **futuro** en el board. Jira lo deja en estado `future` hasta que lo inicies desde la UI. Las fechas son opcionales y se aceptan como `YYYY-MM-DD` o ISO 8601.

```bash
npx tsx src/cli.ts sprint-create endogastro --name "Verificacion feedback octubre" --start 2026-10-26 --end 2026-11-01 --dry-run
npx tsx src/cli.ts sprint-create endogastro --name "Verificacion feedback octubre" --start 2026-10-26 --end 2026-11-01
npx tsx src/cli.ts sprint-create endogastro --name "Sprint seco" --json
```

Garantías:

- **Board resuelto:** usa el único board con sprints o el indicado con `--board`.
- **Fechas:** valida el calendario y que el fin no sea anterior al inicio.
- **Dry-run:** valida el board y muestra el sprint sin crearlo.
- **Sin borrado:** el CLI no elimina sprints; si te equivocaste, se borra desde Jira.

Requiere el permiso **Manage sprints**.

| Exit | Significado |
|---|---|
| `0` | Sprint creado o dry-run |
| `1` | El proyecto no tiene board con sprints o falló la API |
| `2` | Nombre, fechas o board inválidos |

### sprint-start

Inicia un sprint en estado `future`. Si ya está `active`, lo saltea; si está `closed`, falla.

```bash
npx tsx src/cli.ts sprint-start endogastro 69 --dry-run
npx tsx src/cli.ts sprint-start endogastro 69
npx tsx src/cli.ts sprint-start endogastro 69 --json
```

Garantías:

- **Idempotente:** si el sprint ya está activo, no vuelve a llamar a Jira.
- **Dry-run:** resuelve el sprint y muestra el plan sin iniciarlo.
- **Sprint cerrado:** no se puede reiniciar.
- **Un solo activo:** si el board no tiene sprints paralelos, Jira puede rechazar el inicio mientras otro sprint siga activo.

Requiere el permiso **Manage sprints**.

| Exit | Significado |
|---|---|
| `0` | Sprint iniciado, ya activo o dry-run |
| `1` | El proyecto no tiene board con sprints o falló la API |
| `2` | Sprint inexistente, cerrado o ID inválido |

### sprint-move

Mueve issues existentes a un sprint. Valida que el sprint exista en un board Scrum del proyecto y que no esté cerrado antes de escribir.

```bash
npx tsx src/cli.ts sprint-move endogastro 5 ENG-353 ENG-354 --dry-run
npx tsx src/cli.ts sprint-move endogastro 5 ENG-353 ENG-354
npx tsx src/cli.ts sprint-move endogastro 5 ENG-353 --board 7 --json
```

Garantías:

- **Sin inventos:** el `sprintId` y el `boardId` salen de `seiri sprints`; no se resuelven por nombre.
- **Sprint abierto:** rechaza sprints `closed` antes de mover.
- **Parcial:** si una issue falla, sigue con las demás y devuelve exit `4`; si todas fallan, exit `2`.
- **Dry-run:** resuelve el sprint y muestra el plan sin escribir.
- **Cache:** la pertenencia al sprint no se guarda en SQLite; `sprint-move` no modifica el cache.

Requiere el permiso **Manage sprints** y que las issues pertenezcan al board.

| Exit | Significado |
|---|---|
| `0` | Todas movidas o dry-run |
| `2` | Ninguna se pudo mover o el sprint no es válido |
| `4` | Parcial: mover las que quedaron y volver a correr |

## Después del pull

1. Abrí `projects/endogastro/.jira_context.md` y verificá que estén tus epics, stories y subtasks con sus estados.
2. Ese archivo es el contexto que el agente usará para escribir migraciones sin duplicar tickets.
3. Escribí la migración, corré `seiri validate` y después `seiri apply --dry-run` para ver el plan. Recién ahí `seiri apply`.
4. Si hace falta mover estados, usá `seiri transition` con `--dry-run` primero.
5. Para asignar responsables, listá con `seiri users` y después usá `seiri assign` con el `accountId`.
6. Para planificar el trabajo, listá con `seiri sprints`, creá uno con `seiri sprint-create`, iniciálo con `seiri sprint-start` y mové issues con `seiri sprint-move`.

## Skills y agentes

- Skills: `.opencode/skills/` (redacción de issues, jerarquía y contrato de migraciones).
- Agentes: `.opencode/agent/jira-author.md` y `.opencode/agent/jira-reviewer.md`.
- Guía completa: [AGENTS.md](./AGENTS.md).

Abrí opencode desde `jira-seiri/` (no desde la raíz del arsenal) y, si ya estaba abierto, reinicialo para que cargue las skills y los agentes nuevos.

## Arquitectura

Hexagonal-lite. Las dependencias apuntan hacia adentro y hay un puerto por frontera real: Jira API, issues y migraciones.

```text
commands  ->  application  ->  domain
                   |
                   v
                 ports  <-  infrastructure (db, jira)
```

- `domain/` no importa `node:*`, ni SQL, ni HTTP. Se testea puro.
- `application/` orquesta casos de uso y depende de interfaces, no de implementaciones.
- `infrastructure/` es el único lugar con SQL y llamadas HTTP.
- `cli.ts` es el composition root: arma las dependencias a mano y traduce errores a exit codes.

## Estructura

```text
schema.sql                     esquema completo e idempotente
src/
  cli.ts                       composition root + manejo de errores
  commands/                    un archivo por comando (delgados)
  application/                 casos de uso: init, pull, contexto, validate, apply, transition, assign, sprints
  domain/                      reglas puras: errores, contrato v1, jerarquia, similitud
  config/                      rutas y carga de .env
  shared/                      logger y exit codes
  infrastructure/db/           conexión SQLite, PRAGMAs y stores
  infrastructure/jira/         cliente HTTP, retry, ADF y createmeta
  ports/                       interfaces de las fronteras (Jira, issues, migraciones)
projects/
  _template/.env.example       plantilla para nuevos proyectos
  <nombre>/                    .env, .jira_cache.db y .jira_context.md (ignorados por Git)
migrations/                    JSON declarativos versionados en Git
test/                          unit + integración de SQLite
```

## Aislamiento

Este subproyecto es autónomo: no importa nada de otros proyectos del arsenal ni comparte dependencias con ellos. Su `package.json`, `tsconfig.json`, `.env` y base local viven dentro de `jira-seiri/`.

## Documentación

- [AGENT.md del arsenal](../AGENT.md) — reglas de aislamiento
- [README raíz](../README.md) — catálogo de utilidades
