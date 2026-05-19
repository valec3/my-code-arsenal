import express, { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';

// Cargar variables de entorno locales
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10);
const ALLOWED_MIMETYPES = (process.env.ALLOWED_MIMETYPES || 'image/jpeg,image/png,image/gif,application/pdf').split(',');

// Garantizar que la carpeta de subidas exista
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configuración de Habilitación de CORS y parseo de JSON
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Almacenamiento con Multer
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generar un nombre único para evitar colisiones: timestamp + número aleatorio + extensión original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtension}`);
  }
});

// Filtro de validación de Tipo MIME
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Tipos válidos: ${ALLOWED_MIMETYPES.join(', ')}`));
  }
};

// Instancia de Multer configurada con límites e higiene
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: fileFilter
});

// ==============================================================================
// ENDPOINTS
// ==============================================================================

// Endpoint de verificación (Healthcheck)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    config: {
      uploadDir: UPLOAD_DIR,
      maxSizeMb: (MAX_FILE_SIZE / (1024 * 1024)).toFixed(2),
      allowedTypes: ALLOWED_MIMETYPES
    }
  });
});

// Endpoint de Subida de Archivo Individual
app.post('/api/upload', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    // Manejar errores generados específicamente por Multer o filtros
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: `El archivo excede el tamaño máximo permitido de ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(2)} MB.`
        });
      }
      return res.status(400).json({ success: false, error: `Error de Multer: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Validar si efectivamente se envió un archivo en el request
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, proporciona un archivo en el campo "file".'
      });
    }

    // Retornar metadatos útiles al cliente
    res.status(201).json({
      success: true,
      message: 'Archivo subido de manera exitosa.',
      file: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimetype: req.file.mimetype,
        sizeBytes: req.file.size,
        sizeMb: (req.file.size / (1024 * 1024)).toFixed(4),
        path: req.file.path
      }
    });
  });
});

// Middleware Global de Manejo de Errores
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor.'
  });
});

// Inicialización del Servidor
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Servidor de Subida Activo en: http://localhost:${PORT}`);
  console.log(`📁 Directorio de Subida: ${UPLOAD_DIR}`);
  console.log(`🔒 Límite de Archivo: ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`==================================================`);
});
