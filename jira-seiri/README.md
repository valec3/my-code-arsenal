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
```

La IA **nunca** llama a la API de Jira. Solo genera un JSON que vos revisás en tu editor. El CLI valida jerarquía, detecta duplicados y aplica de forma idempotente.

## Estado

Fase 5 — `apply`. Disponible: `seiri init`, `seiri pull`, `seiri validate` y `seiri apply`.

- `pull` sincroniza proyecto, tipos de issue e issues a SQLite (upsert transaccional) y genera `.jira_context.md` con presupuesto de issues.
- `validate` revisa el contrato v1, la jerarquía real del proyecto (desde `createmeta`) y los duplicados por similitud, sin tocar la red.
- `apply` crea las issues en Jira, actualiza el cache local y registra la migración para que sea idempotente y retomable.

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

## Después del pull

1. Abrí `projects/endogastro/.jira_context.md` y verificá que estén tus epics, stories y subtasks con sus estados.
2. Ese archivo es el contexto que el agente usará para escribir migraciones sin duplicar tickets.
3. Escribí la migración, corré `seiri validate` y después `seiri apply --dry-run` para ver el plan. Recién ahí `seiri apply`.

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
  application/                 casos de uso: init, pull, contexto, validate, apply
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
