# 📁 Express File Uploader Utility

Esta es una utilidad del **Arsenal de Códigos** diseñada como un servidor de Express con TypeScript súper optimizado y seguro para la subida, validación y gestión de archivos en el disco local usando Multer.

---

## ⚡ Características Principales

*   **Validación de Tipo MIME Rigurosa**: Filtra las extensiones válidas de los archivos antes de procesar la escritura en disco.
*   **Límites de Tamaño Estrictos**: Controla el tamaño de subida configurado por variables de entorno para evitar ataques de denegación de servicio (DoS).
*   **Formato de Nombre Higienizado**: Genera nombres de archivos únicos en el disco para prevenir sobrescritura de archivos existentes.
*   **Respuestas en JSON Detalladas**: Entrega metadatos formateados del archivo (nombre, tamaño en bytes, tamaño en MB, extensión y ruta de almacenamiento).

---

## 🛠️ Requisitos e Instalación

Para poner en marcha esta utilidad de manera 100% aislada:

### 1. Configurar Entorno
Copia el archivo de plantilla a tu `.env` de producción local:
```bash
cp .env.example .env
```

Ajustá las variables según tus necesidades:
*   `PORT`: Puerto del servidor (por defecto `3000`).
*   `MAX_FILE_SIZE`: Tamaño máximo en bytes (ej: `5242880` para 5MB).
*   `ALLOWED_MIMETYPES`: Tipos mime aceptados (ej: `image/jpeg,image/png,application/pdf`).

### 2. Instalar Dependencias Locales
```bash
npm install
```

### 3. Levantar en Modo Desarrollo
```bash
npm run dev
```

El servidor quedará a la escucha en `http://localhost:3000`.

---

## 📡 Referencia de la API

### 1. Healthcheck
*   **Ruta**: `GET /health`
*   **Descripción**: Verifica el estado operativo de la utilidad y expone la configuración cargada del entorno.
*   **Ejemplo de respuesta**:
    ```json
    {
      "status": "online",
      "timestamp": "2026-05-19T03:28:00.000Z",
      "config": {
        "uploadDir": "./uploads",
        "maxSizeMb": "5.00",
        "allowedTypes": [
          "image/jpeg",
          "image/png",
          "image/gif",
          "application/pdf"
        ]
      }
    }
    ```

### 2. Subir un Archivo
*   **Ruta**: `POST /api/upload`
*   **Método de Envío**: `multipart/form-data`
*   **Parámetro Requerido**: `file` (el archivo físico)
*   **Ejemplo de llamada con `curl`**:
    ```bash
    curl -X POST -F "file=@/ruta/a/tu/archivo.png" http://localhost:3000/api/upload
    ```
*   **Ejemplo de respuesta exitosa (201 Created)**:
    ```json
    {
      "success": true,
      "message": "Archivo subido de manera exitosa.",
      "file": {
        "originalName": "archivo.png",
        "storedName": "file-1716075900000-987654321.png",
        "mimetype": "image/png",
        "sizeBytes": 102400,
        "sizeMb": "0.0977",
        "path": "uploads/file-1716075900000-987654321.png"
      }
    }
    ```
*   **Ejemplo de respuesta con error (400 Bad Request)**:
    ```json
    {
      "success": false,
      "error": "El archivo excede el tamaño máximo permitido de 5.00 MB."
    }
    ```

---

## 🏗️ Construcción para Producción

Para compilar el código TypeScript a JavaScript nativo CommonJS:
```bash
npm run build
npm start
```
El archivo de distribución se compilará en la carpeta `/dist`.
