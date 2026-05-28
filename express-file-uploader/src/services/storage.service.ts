import { StorageStrategy, StorageResult } from '../interfaces/storage-strategy.interface';
import { LocalStorageStrategy } from '../strategies/local-storage.strategy';
import { S3StorageStrategy } from '../strategies/s3-storage.strategy';
import { SupabaseStorageStrategy } from '../strategies/supabase-storage.strategy';
import { GcpStorageStrategy } from '../strategies/gcp-storage.strategy';
import { env } from '../config/env.config';

export class StorageService {
  private activeStrategy: StorageStrategy;
  private providerName: string;

  constructor() {
    const provider = env.STORAGE_PROVIDER;
    this.providerName = provider;

    switch (provider) {
      case 'r2':
      case 's3':
        this.activeStrategy = new S3StorageStrategy();
        break;
      case 'supabase':
        this.activeStrategy = new SupabaseStorageStrategy();
        break;
      case 'gcp':
        this.activeStrategy = new GcpStorageStrategy();
        break;
      case 'local':
      default:
        this.activeStrategy = new LocalStorageStrategy();
        this.providerName = 'local';
        break;
    }

    console.log(`🛡️  StorageService: Proveedor seleccionado -> [${this.providerName.toUpperCase()}]`);
  }

  /**
   * Obtiene el nombre del proveedor activo.
   */
  getProviderName(): string {
    return this.providerName;
  }

  /**
   * Guarda un archivo delegándolo en la estrategia activa.
   */
  async uploadFile(file: Express.Multer.File): Promise<StorageResult> {
    if (!file) {
      throw new Error('No se proporcionó ningún archivo para almacenar.');
    }
    return this.activeStrategy.save(file);
  }

  /**
   * Elimina un archivo delegándolo en la estrategia activa.
   */
  async deleteFile(fileKey: string): Promise<void> {
    if (!fileKey) {
      throw new Error('No se proporcionó la clave o identificador del archivo a eliminar.');
    }
    return this.activeStrategy.delete(fileKey);
  }
}
