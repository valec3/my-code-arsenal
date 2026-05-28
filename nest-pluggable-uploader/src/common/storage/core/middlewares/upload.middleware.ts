import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { StorageModuleConfig } from '../interfaces/storage-config.interface';

export interface MiddlewareResult {
  single: (req: Request, res: Response, next: NextFunction) => void;
  multiple: (req: Request, res: Response, next: NextFunction) => void;
}

export function createUploadMiddlewares(config: StorageModuleConfig): MiddlewareResult {
  const maxFileSize = config.maxFileSize;
  const allowedMimetypes = config.allowedMimetypes;
  const sizeLimitMb = (maxFileSize / (1024 * 1024)).toFixed(2);

  const memoryStorage = multer.memoryStorage();

  const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (allowedMimetypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido (${file.mimetype}). Tipos válidos: ${allowedMimetypes.join(', ')}`));
    }
  };

  const uploadInstance = multer({
    storage: memoryStorage,
    limits: {
      fileSize: maxFileSize
    },
    fileFilter
  });

  const single = (req: Request, res: Response, next: NextFunction): void => {
    uploadInstance.single('file')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            error: `El archivo excede el tamaño máximo permitido de ${sizeLimitMb} MB.`
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
      next();
    });
  };

  const multiple = (req: Request, res: Response, next: NextFunction): void => {
    uploadInstance.array('files', 10)(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            error: `Un archivo excede el tamaño máximo permitido de ${sizeLimitMb} MB.`
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

  return { single, multiple };
}
