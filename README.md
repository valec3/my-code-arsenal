# 🛠️ My Code Arsenal — Utilidades Aisladas de Alta Eficiencia

[![Arquitectura: Monorepo Aislado](https://img.shields.io/badge/Architecture-Isolated_Monorepo-blueviolet?style=for-the-badge)](https://github.com/)
[![Licencia: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> Un arsenal de utilidades y mini-apps de desarrollo 100% aisladas, diseñadas bajo el principio de **cero acoplamiento**. Un solo repositorio de Git para gobernarlas a todas, pero con independencia absoluta de entornos, dependencias y ejecuciones.

---

## 🏛️ Filosofía de Arquitectura: Aislamiento Total

A diferencia de los monorepos tradicionales sobrecargados con herramientas como Turborepo, Lerna o Nx, este arsenal prioriza la **simplicidad y la velocidad**. 

### Principios de Diseño:
1. **Cero Dependencias Cruzadas**: Ningún subproyecto puede importar archivos o depender de paquetes de otro subproyecto.
2. **Entornos Autónomos**: Cada mini-app tiene su propio archivo de dependencias (`package.json`), su configuración de TypeScript (`tsconfig.json`), sus variables de entorno (`.env`) y su propio servidor o flujo de ejecución.
3. **Control de Versiones Unificado**: Un único `.git` en la raíz permite trackear todo el arsenal de manera simple y centralizada, facilitando la portabilidad del código.

---

## 🎒 El Arsenal de Utilidades

| Utilidad | Stack Tecnológico | Propósito Principal | Estado | Acceso Directo |
| :--- | :--- | :--- | :---: | :---: |
| **`express-file-uploader`** | Express, TypeScript, Multer | Servidor optimizado para subida, filtrado y validación rigurosa de archivos. | 🏗️ En Desarrollo | [Explorar 📂](./express-file-uploader) |
| **`node-jira-bot`** | Node.js, TypeScript, Axios | CLI y automatización para la creación y gestión ágil de tareas directamente en Jira. | 🏗️ En Desarrollo | [Explorar 📂](./node-jira-bot) |

---

## 🚀 Guía de Inicio Rápido

Para utilizar cualquiera de las herramientas, simplemente navegá al directorio de la utilidad e inicializala:

### Ejemplo con `express-file-uploader`:
```bash
# 1. Navegar al directorio de la utilidad
cd express-file-uploader

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Instalar dependencias locales
npm install

# 4. Levantar en modo de desarrollo
npm run dev
```

> [!WARNING]
> **REGLA DE ORO**: Nunca intentes ejecutar `npm install` o crear un `package.json` en la raíz del repositorio. Toda acción debe ejecutarse estrictamente dentro del subdirectorio de cada utilidad.

---

## 🧠 Integración con Agentes de IA

Este repositorio está optimizado para trabajar con asistentes de inteligencia artificial (como Cursor, Copilot o Windsurf) sin que rompan la arquitectura aislada. Hemos definido reglas estrictas que la IA cargará automáticamente:
* Ver detalles de las directrices en: [agent.md](./agent.md) y [.agents/rules](./.agents/rules).

---

## 🤝 Cómo Contribuir con una Nueva Utilidad

Si querés añadir un nuevo script o mini-app al arsenal:
1. Creá una nueva carpeta en la raíz con un nombre descriptivo y en minúsculas (ej: `my-new-utility`).
2. Inicializá su propio entorno (`package.json`, `tsconfig.json`, `.gitignore` local, etc.).
3. Asegurá que no dependa de nada externo a su propia carpeta.
4. Documentá su uso en un `README.md` interno.
5. Registrala en la tabla de este `README.md` principal.
6. Lee los lineamientos detallados en [CONTRIBUTING.md](./CONTRIBUTING.md).

---

Desarrollado con ❤️ y con un enfoque obsesivo en la **simplicidad y el desacoplamiento**.
