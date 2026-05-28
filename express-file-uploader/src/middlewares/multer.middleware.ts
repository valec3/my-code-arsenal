import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { env } from '../config/env.config';

const MAX_FILE_SIZE = env.MAX_FILE_SIZE;
const ALLOWED_MIMETYPES = env.ALLOWED_MIMETYPES;
const FILE_SIZE_LIMIT_MB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(2);

// Almacenamiento temporal en memoria
const memoryStorage = multer.memoryStorage();

// Filtro de tipos MIME permitidos
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido (${file.mimetype}). Tipos válidos: ${ALLOWED_MIMETYPES.join(', ')}`));
  }
};

// Instancia interna de Multer
const uploadInstance = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: fileFilter
});

/**
 * Middleware Express para procesar la subida física del archivo y capturar errores de Multer.
 * Mantiene el archivo de rutas 100% limpio y declarativo.
 */
export const uploadSingleFile = (req: Request, res: Response, next: NextFunction): void => {
  uploadInstance.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          error: `El archivo excede el tamaño máximo permitido de ${FILE_SIZE_LIMIT_MB} MB.`
        });
        return;
      }
      res.status(400).json({ 
        success: false, 
        error: `Error de carga física: ${err.message}` 
      });
      return;
    } else if (err) {
      res.status(400).json({ 
        success: false, 
        error: err.message 
      });
      return;
    }
    
    // Si no hay errores, delegamos al siguiente middleware/controlador
    next();
  });
};

/**
 * Middleware Express para procesar la subida física de múltiples archivos y capturar errores de Multer.
 */
export const uploadMultipleFiles = (req: Request, res: Response, next: NextFunction): void => {
  uploadInstance.array('files', 10)(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          error: `Un archivo excede el tamaño máximo permitido de ${FILE_SIZE_LIMIT_MB} MB.`
        });
        return;
      }
      res.status(400).json({ 
        success: false, 
        error: `Error de carga física múltiple: ${err.message}` 
      });
      return;
    } else if (err) {
      res.status(400).json({ 
        success: false, 
        error: err.message 
      });
      return;
    }
    
    next();
  });
};

export { FILE_SIZE_LIMIT_MB, ALLOWED_MIMETYPES };
