# 🤖 Jira Hierarchical Provisioner (Aprovisionador Modular)

Esta utilidad del **Arsenal de Códigos** es un script en Node.js y TypeScript diseñado para automatizar la planeación e inserción de backlogs en Jira Cloud de forma jerárquica en cascada.

En lugar de crear manualmente Épicas, Historias de Usuario (HUs) y Subtareas una por una desde la interfaz web, el programa lee un archivo estructurado `backlog.json`, realiza la conexión con la API REST v3 y genera los elementos secuencialmente, inyectando de manera automática la clave (`KEY`) del padre resultante en cada hijo correspondiente.

---

## 🏛️ Estructura Arquitectónica del Código

Para garantizar un código limpio, legible y mantenible, la utilidad sigue principios de diseño desacoplado:

*   `src/config/env.ts`: Centraliza la lectura, tipado riguroso y validación del `.env` local, impidiendo la ejecución ante configuraciones incompletas.
*   `src/types/jira.types.ts`: Define las interfaces estrictas de TypeScript para los payloads de la API y el esquema estructurado del JSON de backlog.
*   `src/utils/adf.ts`: Helper encargado de traducir texto plano al estándar **Atlassian Document Format (ADF)** (un JSON jerárquico requerido por la versión 3 de la API de Jira para las descripciones).
*   `src/services/jira.service.ts`: Cliente API encapsulado con Axios que se encarga de las cabeceras de autorización y de la creación genérica de Issues linkeados por parentesco.
*   `src/index.ts`: Orquestador principal que valida la conexión, parsea el JSON y coordina secuencialmente la creación de **Épica -> HU -> Subtarea** en tiempo real.

---

## 📋 Estructura de `backlog.json`

Creá el archivo `backlog.json` en la raíz del subproyecto `/node-jira-bot`. Podés definir una sola Épica o una lista de ellas. Estructura de muestra:

```json
[
  {
    "summary": "ÉPICA: Autenticación de Usuarios y Seguridad",
    "description": "Flujo de registro, login y seguridad de tokens para el sistema.",
    "stories": [
      {
        "summary": "HU: Registro con correo y contraseña",
        "description": "Como usuario nuevo, quiero registrarme para acceder a la app.",
        "tasks": [
          {
            "summary": "Tarea: Diseñar el formulario UI de registro",
            "description": "Crear el maquetado del formulario de registro con validaciones visuales."
          },
          {
            "summary": "Tarea: Implementar endpoint de registro en API",
            "description": "Crear ruta POST /auth/register y encriptar contraseña."
          }
        ]
      }
    ]
  }
]
```

---

## ⚙️ Configuración e Instalación

### 1. Variables de Entorno
Copia la plantilla local y configurala con tus datos:
```bash
cp .env.example .env
```

Asegúrate de completar:
*   `JIRA_HOST`: La URL de tu instancia de Jira Cloud (ej: `https://mi-empresa.atlassian.net`).
*   `JIRA_USER_EMAIL`: Tu correo registrado en Jira Cloud.
*   `JIRA_API_TOKEN`: El token de API que generaste desde la seguridad de tu perfil de Atlassian Cloud.
*   `JIRA_PROJECT_KEY`: Clave del proyecto destino (ej: `KAN`).

*Opcionales (si tu Jira usa nombres personalizados para los tipos de Issue)*:
*   `JIRA_EPIC_TYPE` (Por defecto: `Epic`)
*   `JIRA_STORY_TYPE` (Por defecto: `Story`)
*   `JIRA_SUBTASK_TYPE` (Por defecto: `Sub-task`)

### 2. Instalar Dependencias Locales
```bash
npm install
```

### 3. Ejecutar el Sincronizador
```bash
npm run dev
```

El script se encargará de validar la conexión con Jira Cloud y provisionar en cascada secuencial todo el backlog, arrojando en tiempo real las keys y los enlaces directos a las tareas recién creadas en tu navegador.
