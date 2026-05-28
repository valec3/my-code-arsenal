import { Request, Response, NextFunction } from 'express';
import { StorageModuleConfig } from './interfaces/storage-config.interface';
import { StorageStrategy, StorageResult } from './interfaces/storage-strategy.interface';
import { createUploadMiddlewares } from './middlewares/upload.middleware';

export interface StorageMiddlewares {
  single: (req: Request, res: Response, next: NextFunction) => void;
  multiple: (req: Request, res: Response, next: NextFunction) => void;
}

export class StorageModule {
  private uploadMiddlewares: StorageMiddlewares;
  private logger?: StorageModuleConfig['logger'];

  constructor(
    private readonly strategy: StorageStrategy,
    config: StorageModuleConfig
  ) {
    if (!strategy) {
      throw new Error('❌ StorageModule requiere una estrategia de almacenamiento válida.');
    }
    if (!config) {
      throw new Error('❌ StorageModule requiere un objeto de configuración válido.');
    }
    if (!config.maxFileSize || config.maxFileSize <= 0) {
      throw new Error('❌ StorageModule requiere un [maxFileSize] positivo en bytes.');
    }
    if (!config.allowedMimetypes || config.allowedMimetypes.length === 0) {
      throw new Error('❌ StorageModule requiere al menos un tipo en [allowedMimetypes].');
    }

    this.logger = config.logger || {
      info: (msg, ...args) => console.log(`[StorageModule] INFO: ${msg}`, ...args),
      error: (err, msg) => console.error(`[StorageModule] ERROR: ${msg}`, err),
      warn: (msg, ...args) => console.warn(`[StorageModule] WARN: ${msg}`, ...args)
    };

    const finalConfig: StorageModuleConfig = {
      ...config,
      logger: this.logger
    };

    // Almacenamos los middlewares bajo nuestra interfaz semántica
    const { single, multiple } = createUploadMiddlewares(finalConfig);
    this.uploadMiddlewares = { single, multiple };

    this.logger.info('🛡️  StorageModule: Inicializado correctamente con inyección de estrategias.');
  }

  /**
   * Expone los middlewares de subida de archivos (upload.single y upload.multiple) 
   * listos para ser consumidos de forma semántica en Express.
   */
  public get middlewares(): StorageMiddlewares {
    return this.uploadMiddlewares;
  }

  public get activeStrategy(): StorageStrategy {
    return this.strategy;
  }

  public async uploadFile(file: Express.Multer.File): Promise<StorageResult> {
    if (!file) {
      throw new Error('No se proporcionó ningún archivo para almacenar.');
    }
    return this.strategy.save(file);
  }

  public async deleteFile(fileKey: string): Promise<void> {
    if (!fileKey) {
      throw new Error('No se proporcionó la clave o identificador del archivo a eliminar.');
    }
    return this.strategy.delete(fileKey);
  }
}
