import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storage.service';
import { FILE_SIZE_LIMIT_MB, ALLOWED_MIMETYPES } from '../middlewares/multer.middleware';
import { logger } from '../utils/logger.util';

export class UploadController {
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
  }

  /**
   * Procesa la subida de un único archivo
   */
  uploadSingle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Validar si efectivamente se envió un archivo en el request
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Por favor, proporciona un archivo en el campo "file".'
      });
      return;
    }

    try {
      // Delegar la subida a la estrategia activa en el StorageService
      const result = await this.storageService.uploadFile(req.file);

      res.status(201).json({
        success: true,
        message: 'Archivo procesado y subido de manera exitosa.',
        data: {
          originalName: req.file.originalname,
          storedName: result.storedName,
          mimetype: req.file.mimetype,
          sizeBytes: result.sizeBytes,
          sizeMb: (result.sizeBytes / (1024 * 1024)).toFixed(4),
          pathOrUrl: result.pathOrUrl,
          provider: result.provider
        }
      });
    } catch (error: any) {
      logger.error(error, `❌ Error al subir archivo individual [${req.file.originalname}]`);
      res.status(500).json({
        success: false,
        error: `Fallo en el proveedor de almacenamiento: ${error.message}`
      });
    }
  };

  /**
   * Elimina un archivo mediante su clave o identificador único
   */
  deleteFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { key } = req.body;

    if (!key) {
      res.status(400).json({
        success: false,
        error: 'Por favor, proporciona el "key" o nombre del archivo a eliminar en el cuerpo del request.'
      });
      return;
    }

    try {
      await this.storageService.deleteFile(key);
      res.status(200).json({
        success: true,
        message: `Archivo "${key}" eliminado de manera exitosa del storage.`
      });
    } catch (error: any) {
      logger.error(error, `❌ Error al eliminar archivo con clave [${key}]`);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Procesa la subida de múltiples archivos en paralelo
   */
  uploadMultiple = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Por favor, proporciona al menos un archivo en el campo "files".'
      });
      return;
    }

    try {
      // Disparar las subidas en paralelo a través del StorageService
      const uploadPromises = files.map(file => this.storageService.uploadFile(file));
      const results = await Promise.all(uploadPromises);

      res.status(201).json({
        success: true,
        message: `${files.length} archivos procesados y subidos de manera exitosa.`,
        data: results.map((result, index) => ({
          originalName: files[index].originalname,
          storedName: result.storedName,
          mimetype: files[index].mimetype,
          sizeBytes: result.sizeBytes,
          sizeMb: (result.sizeBytes / (1024 * 1024)).toFixed(4),
          pathOrUrl: result.pathOrUrl,
          provider: result.provider
        }))
      });
    } catch (error: any) {
      logger.error(error, `❌ Error al subir múltiples archivos en paralelo`);
      res.status(500).json({
        success: false,
        error: `Fallo en el proveedor de almacenamiento múltiple: ${error.message}`
      });
    }
  };

  /**
   * Healthcheck con información técnica del estado y estrategia activa
   */
  healthCheck = (req: Request, res: Response): void => {
    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      activeProvider: this.storageService.getProviderName().toUpperCase(),
      config: {
        maxSizeMb: FILE_SIZE_LIMIT_MB,
        allowedTypes: ALLOWED_MIMETYPES
      }
    });
  };
}
