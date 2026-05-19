# 🤝 Guía de Contribución — My Code Arsenal

¡Qué hacés, hermano! Si estás leyendo esto es porque querés sumar una nueva utilidad de alta eficiencia a este arsenal. Dejame felicitarte por querer aportar. Para que este repositorio siga siendo una máquina bien aceitada, súper limpia y libre de acoplamiento de dependencias, tenemos que seguir a rajatabla una serie de directrices de nivel arquitectónico.

---

## 💎 La Regla de Oro: Aislamiento Físico y Conceptual

Cualquier utilidad que agregues debe funcionar de manera **autónoma**. Si borramos la carpeta de tu utilidad, el resto del repositorio no debe enterarse de su ausencia ni verse afectado en lo más mínimo.

---

## 🛠️ Paso a Paso para Agregar una Nueva Utilidad

Cuando vayas a crear un nuevo proyecto utilitario, seguí este checklist riguroso:

### 1. Crear el Directorio del Proyecto
Creá una carpeta en la raíz del repositorio. Utilizá nombres en minúsculas separados por guiones (`kebab-case`).
```bash
# Ejemplo:
mkdir node-pdf-parser
```

### 2. Inicializar el Entorno de la Utilidad
Entrá a la carpeta e inicializá el gestor de paquetes de tu preferencia de forma local:
```bash
cd node-pdf-parser
npm init -y
# O si usás Bun, Go, Rust, etc., inicializá el setup nativo del lenguaje.
```

### 3. Crear el Archivo `.gitignore` Local
Cada utilidad **debe** tener su propio `.gitignore` para controlar de forma fina sus exclusiones locales (carpetas de caché del compilador, archivos temporales del script, etc.).
Por ejemplo, si manejás subida de archivos, excluí la carpeta donde se almacenan las subidas locales.

### 4. Crear el Archivo `.env.example`
Si tu utilidad consume credenciales, APIs o puertos configurables, no expongas tus tokens reales:
* Creá un archivo `.env.example` con las variables en blanco o con valores ficticios explicativos.
* Añadí `.env` al `.gitignore` local de tu utilidad.

### 5. Escribir un `README.md` Dedicado
El archivo de documentación de tu mini-app debe detallar:
*   Qué problema resuelve.
*   Cómo instalar dependencias y levantar el proyecto en modo de desarrollo y producción.
*   Ejemplos prácticos de uso (comandos, curls, etc.).

### 6. Registrar la Utilidad en la Raíz
Abrí el [README.md principal](./README.md) en la raíz y añadí una fila en la tabla de utilidades con el nombre de tu proyecto, stack, propósito y enlace directo.

---

## 📢 Estándar de Commits (Conventional Commits)

En este arsenal nos tomamos en serio la legibilidad del historial de Git. **Queda terminantemente prohibido utilizar mensajes de commit vagos** (como "cambios", "fix", "update"). 

Usamos **Conventional Commits** de forma estricta. Todo commit debe indicar el ámbito (`scope`) afectado:

*   `feat(uploader): agregar validador de extensiones PDF`
*   `fix(jira-bot): corregir mapeo de estados de tarea`
*   `docs(root): actualizar tabla de utilidades en README`
*   `chore(deps): actualizar axios en node-jira-bot`

> [!WARNING]
> **Sin atribución de IA**: Si usás un asistente de desarrollo, nunca agregues campos como `Co-Authored-By` o menciones de autoría automatizada en los commits. La autoría es 100% tuya (el humano lidera, la IA ejecuta).

---

Si tenés dudas sobre si tu utilidad encaja o cómo estructurarla, dale una mirada a los subproyectos existentes como referencia de excelencia técnica. ¡Ponete las pilas y a codear!
