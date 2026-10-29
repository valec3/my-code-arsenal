# Próxima sesión — Endogastro / jira-seiri

Última actualización: 2026-10-29
Estado: sesión cerrada, sin cambios de código pendientes.

## Dónde retomar

1. Abrí opencode desde `jira-seiri/`.
2. Leé este archivo y `projects/endogastro/.jira_context.md`.
3. Verificá el estado real con:

```bash
npx tsx src/cli.ts sprints endogastro
npx tsx src/cli.ts pull endogastro
```

## Estado actual en Jira

- **Sprint 69** «Verificación feedback octubre»: **active**, 2026-10-26 → 2026-11-01.
- **Sprint 36** «ENG Sprint 4»: **active** y viejo (2026-09-01 → 2026-09-02). El board permite sprints paralelos; no se cerró.
- **ENG-353..367**: 15 issues del feedback web/app, **In Progress**, asignadas a **Victor** y dentro del sprint 69.
- Board: «ENG board» (id 2), tipo `simple` (team-managed).
- Cache: 233 issues. Estados: To Do 150, Done 69, In Progress 10, In Review 4. No existe estado «Backlog».

## Pendientes, en orden

### 1. Verificar las 15 issues y pasarlas a Done

| Key | Qué verificar |
|---|---|
| ENG-353 | Tildes en Gastroenterología/Servicios; tabs Especialidades/Otros sin recargar; desktop y mobile |
| ENG-354 | Especialistas, laboratorio y farmacia toman datos/fotos del sistema; un cambio se refleja en la web |
| ENG-355 | CPRE como procedimiento; Puno en cada especialidad; metas locales; sin contenido duplicado |
| ENG-356 | Story paciente: reservas, tienda y sesión OK en iOS y Android |
| ENG-357 | Entrada con fondo claro/logo; copy del slide; slider con más especialidades; bordes amarillos; Cinzel; INICIO |
| ENG-358 | Reservas con nombre/especialidad/foto desde la web; placeholder; horas centradas; fecha con borde verde |
| ENG-359 | Tienda con bordes en farmacia/laboratorio/búsqueda; foto desde la web; placeholder; sin deformar |
| ENG-360 | Editar datos guarda y refleja; logout vuelve al login; PERÚ eliminado |
| ENG-361 | Story especialista: atención, receta y laboratorio OK en iOS y Android |
| ENG-362 | Login con anuncio de trabajo; «Portal del especialista»; botón Perfil médico |
| ENG-363 | Paciente nuevo abre pestaña inicial; formulario limpio; últimos 10 pacientes; criterio único de salas |
| ENG-364 | Atención centrada con borde; inputs/diagnóstico/búsqueda con borde; fondos; WhatsApp; contraste |
| ENG-365 | Indicaciones y dieta vacías; receta sin recomendaciones no inventa texto; PDF fiel |
| ENG-366 | Previsualizar receta/lab/farmacia no crea; guardar genera PDF; repetir preview no duplica |
| ENG-367 | Botones Orden de laboratorio/Finalizar; sin «Volver a examen físico»; finalizar al final del lab; no pierde receta |

Cuando el usuario confirme, mover en bloque:

```bash
npx tsx src/cli.ts transition endogastro ENG-353 ENG-354 ENG-355 ENG-356 ENG-357 ENG-358 ENG-359 ENG-360 ENG-361 ENG-362 ENG-363 ENG-364 ENG-365 ENG-366 ENG-367 --to Done
```

Los criterios completos están en `migrations/2026-10-26_feedback-web-app.json`.

### 2. Decidir qué hacer con el sprint 36

Sigue activo desde septiembre. Opciones: cerrarlo desde Jira o dejarlo si tiene trabajo real. No hay comando `sprint-close`.

### 3. Detallar los ajustes de laboratorio

Quedaron pendientes de desglose en la conversación anterior. Revisar el feedback de laboratorio y convertirlo en tareas concretas, sin duplicar las existentes.

### 4. Recibir la lista de bugs de otras áreas

El usuario iba a pasar una lista de bugs fuera de web/app. Agrupar por área y evitar saturar de issues.

### 5. Consulta de pendientes antiguos (no ejecutada)

El usuario preguntó qué pendientes llevan demasiado tiempo. Quedó sin correr por el cierre de sesión. Consultar en el cache:

```sql
SELECT key, issue_type, status, substr(jira_created_at, 1, 10) AS created,
       CAST(julianday('now') - julianday(jira_created_at) AS INTEGER) AS age_days,
       summary
FROM issues
WHERE status IN ('To Do', 'In Progress', 'In Review')
ORDER BY jira_created_at ASC
LIMIT 35;
```

Agrupar por antigüedad (30-89, 90-179, 180+) y por épica. Para In Progress, mirar también `jira_updated_at` (inactividad).

## Comandos útiles

```bash
npx tsx src/cli.ts sprints endogastro
npx tsx src/cli.ts sprint-create endogastro --name "..." --start YYYY-MM-DD --end YYYY-MM-DD --dry-run
npx tsx src/cli.ts sprint-start endogastro <sprintId> --dry-run
npx tsx src/cli.ts sprint-move endogastro <sprintId> <keys...> --dry-run
npx tsx src/cli.ts users endogastro
npx tsx src/cli.ts assign endogastro <accountId> <keys...> --dry-run
npx tsx src/cli.ts transition endogastro <keys...> --to "<estado>" --dry-run
```

Usar siempre `npx tsx src/cli.ts`; `npm run seiri -- ...` descarta flags en este entorno.

## Commits de la sesión

- `1bde259` — feedback agrupado web/app.
- `7cee180` — `users`/`assign`.
- `1de9465` — listar/mover sprints.
- `cc6ec21` — crear sprints.
- `8225049` — iniciar sprints.

## Gotchas

- El board es team-managed: `type = simple`, no `scrum`. Aceptar `scrum` y `simple`.
- `PUT /rest/agile/1.0/sprint/{id}` exige `name`; solo `{state:'active'}` da 400.
- Jira permite sprints paralelos en este board: iniciar 69 no cerró el 36.
- `labels` está en el schema pero `apply` no lo envía a Jira; usar prefijo en el summary.
- No correr `npm run build`.
- Sigue untracked `node-jira-bot/projects/endogastro/backlog-2026-09-22.json`; no tocar.
- Victor: `accountId` `712020:4bdb58ab-095f-4b99-aa9e-96cb58554165`.
