# 🤖 Jira Hierarchical Provisioner (Aprovisionador Multi-Proyecto)

Esta utilidad del **Arsenal de Códigos** es un script en Node.js y TypeScript diseñado para automatizar la planeación e inserción de backlogs en Jira Cloud de forma jerárquica en cascada, con soporte para **múltiples proyectos** mediante carpetas dedicadas.

En lugar de crear manualmente Épicas, Historias de Usuario (HUs) y Tareas una por una desde la interfaz web, el programa lee un archivo estructurado `backlog.json`, realiza la conexión con la API REST v3 y genera los elementos secuencialmente, inyectando de manera automática la clave (`KEY`) del padre resultante en cada hijo correspondiente.

**Jerarquía**: Épica → Historia de Usuario → Tarea (Task estándar, NO Sub-task)

---

## 📁 Estructura Multi-Proyecto

Cada proyecto vive en su propia carpeta bajo `projects/` con su `.env` y `backlog.json`. Las credenciales comunes (JIRA_HOST, JIRA_USER_EMAIL, JIRA_API_TOKEN) van en el `.env` raíz y se comparten entre todos los proyectos.

```
node-jira-bot/
  .env                          # Credenciales compartidas (HOST, EMAIL, TOKEN)
  projects/
    cgs/
      .env                      # JIRA_PROJECT_KEY=CGS
      backlog.json              # Backlog del proyecto CGS
    mi-otro-proyecto/
      .env                      # JIRA_PROJECT_KEY=KAN
      backlog.json
    _template/                  # Plantilla para nuevos proyectos
      .env.example
      backlog.json.example
```

### Uso

```bash
# Provisionar un proyecto específico
pnpm run dev cgs

# Provisionar sin proyecto (usa el .env raíz — modo legacy)
pnpm run dev

# Purgar el último backlog creado en un proyecto
pnpm run purge cgs

# Purgar issues específicos
pnpm run purge cgs KEY-1 KEY-2

# Purgar TODOS los issues del proyecto (⚠️ nuclear)
pnpm run purge cgs --all
```

---

## 🏛️ Estructura Arquitectónica del Código

Para garantizar un código limpio, legible y mantenible, la utilidad sigue principios de diseño desacoplado:

*   `src/config/env.ts`: Centraliza la carga de configuración multi-proyecto. La función `loadConfig(projectName)` combina el `.env` raíz (credenciales) con el `.env` del proyecto (JIRA_PROJECT_KEY, tipos).
*   `src/types/jira.types.ts`: Define las interfaces estrictas de TypeScript para los payloads de la API y el esquema estructurado del JSON de backlog.
*   `src/utils/adf.ts`: Helper encargado de traducir texto plano al estándar **Atlassian Document Format (ADF)** (un JSON jerárquico requerido por la versión 3 de la API de Jira para las descripciones).
*   `src/services/jira.service.ts`: Cliente API encapsulado con Axios. Recibe `EnvConfig` en el constructor para soportar múltiples proyectos sin estado global.
*   `src/index.ts`: Orquestador principal que parsea el nombre del proyecto desde CLI, carga su configuración, y coordina secuencialmente la creación de **Épica → HU → Tarea**.
*   `src/purge.ts`: Utilidad de limpieza con soporte multi-proyecto. Lee `created-issues.json` desde la carpeta del proyecto correspondiente.

---

## 📋 Estructura de `backlog.json`

Cada proyecto tiene su propio `backlog.json` en `projects/<nombre>/backlog.json`. Podés definir una sola Épica o una lista de ellas. Estructura de muestra:

```json
[
  {
    "summary": "ÉPICA: Autenticación de Usuarios y Seguridad",
    "description": "Flujo de registro, login y seguridad de tokens para el sistema.",
    "priority": "High",
    "stories": [
      {
        "summary": "HU: Registro con correo y contraseña",
        "description": "Como usuario nuevo, quiero registrarme para acceder a la app.",
        "priority": "Highest",
        "storyPoints": 5,
        "tasks": [
          {
            "summary": "Tarea: Diseñar el formulario UI de registro",
            "description": "Crear el maquetado del formulario de registro con validaciones visuales.",
            "priority": "High"
          },
          {
            "summary": "Tarea: Implementar endpoint de registro en API",
            "description": "Crear ruta POST /auth/register y encriptar contraseña.",
            "priority": "Highest"
          }
        ]
      }
    ]
  }
]
```

**Tipos de issue usados**: `Epic`, `Story`, `Task` (todos configurables por proyecto en su `.env`).

---

## ⚙️ Configuración e Instalación

### 1. Variables de Entorno — Raíz

Copiá la plantilla y configurá tus credenciales comunes:

```bash
cp .env.example .env
```

Completá en el `.env` raíz:
*   `JIRA_HOST`: La URL de tu instancia de Jira Cloud (ej: `https://mi-empresa.atlassian.net`).
*   `JIRA_USER_EMAIL`: Tu correo registrado en Jira Cloud.
*   `JIRA_API_TOKEN`: El token de API que generaste desde la seguridad de tu perfil de Atlassian Cloud.

### 2. Crear un Proyecto Nuevo

```bash
# Copiá la plantilla
mkdir -p projects/mi-proyecto
cp projects/_template/.env.example projects/mi-proyecto/.env
cp projects/_template/backlog.json.example projects/mi-proyecto/backlog.json

# Editá el .env del proyecto con tu JIRA_PROJECT_KEY
# Editá el backlog.json con tus épicas, historias y tareas
```

### 3. Instalar Dependencias Locales

```bash
pnpm install
```

### 4. Ejecutar el Sincronizador

```bash
pnpm run dev mi-proyecto
```

El script se encargará de validar la conexión con Jira Cloud y provisionar en cascada secuencial todo el backlog, arrojando en tiempo real las keys y los enlaces directos a las tareas recién creadas en tu navegador.
