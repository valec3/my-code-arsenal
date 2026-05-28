import fs from 'fs';
import path from 'path';
import { StorageStrategy, StorageResult } from '../interfaces/storage-strategy.interface';
import { StorageModuleConfig } from '../interfaces/storage-config.interface';
import { sanitizeFilename } from '../utils/filename.util';

export interface LocalStorageConfig {
  uploadDir: string;
  baseUrl?: string;
  logger?: StorageModuleConfig['logger'];
}

export class LocalStorageStrategy implements StorageStrategy {
  private uploadDir: string;
  private baseUrl?: string;
  private logger?: StorageModuleConfig['logger'];

  constructor(config: LocalStorageConfig) {
    if (!config || !config.uploadDir) {
      throw new Error('❌ LocalStorageStrategy requiere especificar el [uploadDir] en la configuración.');
    }
    this.uploadDir = config.uploadDir;
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async save(file: Express.Multer.File): Promise<StorageResult> {
    const startTime = Date.now();
    const sanitized = sanitizeFilename(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const storedName = `${uniqueSuffix}-${sanitized}`;
    const destinationPath = path.join(this.uploadDir, storedName);

    await fs.promises.writeFile(destinationPath, file.buffer);

    const duration = Date.now() - startTime;
    this.logger?.info(`💾 LocalStorage: Archivo guardado con éxito como [${storedName}] en ${duration}ms`);

    const fileUrl = this.baseUrl
      ? `${this.baseUrl.replace(/\/$/, '')}/${storedName}`
      : destinationPath.replace(/\\/g, '/');

    return {
      success: true,
      storedName,
      pathOrUrl: fileUrl,
      sizeBytes: file.size,
      provider: 'local'
    };
  }

  async delete(fileKey: string): Promise<void> {
    const safeKey = path.basename(fileKey);
    const filePath = path.join(this.uploadDir, safeKey);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      this.logger?.info(`🗑️ LocalStorage: Archivo [${safeKey}] eliminado correctamente.`);
    } else {
      throw new Error(`Archivo no encontrado en almacenamiento local: ${safeKey}`);
    }
  }
}
