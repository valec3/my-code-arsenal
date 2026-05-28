import fs from 'fs';
import path from 'path';
import { StorageStrategy, StorageResult } from '../interfaces/storage-strategy.interface';
import { env } from '../config/env.config';
import { sanitizeFilename } from '../utils/filename.util';
import { logger } from '../utils/logger.util';

export class LocalStorageStrategy implements StorageStrategy {
  private uploadDir: string;

  constructor() {
    this.uploadDir = env.UPLOAD_DIR!;
    // Asegurar que el directorio de subidas exista
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async save(file: Express.Multer.File): Promise<StorageResult> {
    const startTime = Date.now();
    // Sanitizar nombre de archivo contra inyecciones y directory traversal
    const sanitized = sanitizeFilename(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const storedName = `${uniqueSuffix}-${sanitized}`;
    const destinationPath = path.join(this.uploadDir, storedName);

    // Escribir el buffer de Multer en el disco
    await fs.promises.writeFile(destinationPath, file.buffer);

    const duration = Date.now() - startTime;
    logger.info({
      storedName,
      originalName: file.originalname,
      sizeBytes: file.size,
      durationMs: duration
    }, `💾 LocalStorage: Archivo guardado localmente con éxito en ${duration}ms`);

    return {
      success: true,
      storedName: storedName,
      pathOrUrl: destinationPath.replace(/\\/g, '/'), // Normalizar separadores de Windows
      sizeBytes: file.size,
      provider: 'local'
    };
  }

  async delete(fileKey: string): Promise<void> {
    // Asegurar que solo limpie dentro de la carpeta uploads (evitar Path Traversal)
    const safeKey = path.basename(fileKey);
    const filePath = path.join(this.uploadDir, safeKey);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    } else {
      throw new Error(`Archivo no encontrado localmente: ${safeKey}`);
    }
  }
}
