import { StorageStrategy, StorageResult } from '../interfaces/storage-strategy.interface';
import { StorageModuleConfig } from '../interfaces/storage-config.interface';

export interface GcpStorageConfig {
  projectId: string;
  bucketName: string;
  logger?: StorageModuleConfig['logger'];
}

export class GcpStorageStrategy implements StorageStrategy {
  private logger?: StorageModuleConfig['logger'];

  constructor(config: GcpStorageConfig) {
    if (!config || !config.projectId || !config.bucketName) {
      throw new Error('❌ GcpStorageStrategy requiere especificar [projectId] y [bucketName] en la configuración.');
    }
    this.logger = config.logger;
    this.logger?.info('🔌 GcpStorageStrategy: Inicializado (Modo Plantilla/Mock)');
  }

  async save(file: Express.Multer.File): Promise<StorageResult> {
    this.logger?.info(`[Google Cloud Storage Mock] Simulando subida de: ${file.originalname}`);

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const storedName = `gcp-mock-${uniqueSuffix}-${file.originalname}`;

    return {
      success: true,
      storedName,
      pathOrUrl: `https://storage.googleapis.com/gcp-mock-bucket/${storedName}`,
      sizeBytes: file.size,
      provider: 'gcp (MOCK)'
    };
  }

  async delete(fileKey: string): Promise<void> {
    this.logger?.info(`[Google Cloud Storage Mock] Simulando eliminación de: ${fileKey}`);
  }
}
