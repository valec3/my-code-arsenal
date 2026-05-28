import { StorageStrategy, StorageResult } from '../interfaces/storage-strategy.interface';
import { StorageModuleConfig } from '../interfaces/storage-config.interface';

export interface SupabaseStorageConfig {
  url: string;
  anonKey: string;
  logger?: StorageModuleConfig['logger'];
}

export class SupabaseStorageStrategy implements StorageStrategy {
  private logger?: StorageModuleConfig['logger'];

  constructor(config: SupabaseStorageConfig) {
    if (!config || !config.url || !config.anonKey) {
      throw new Error('❌ SupabaseStorageStrategy requiere especificar [url] y [anonKey] en la configuración.');
    }
    this.logger = config.logger;
    this.logger?.info('🔌 SupabaseStorageStrategy: Inicializado (Modo Plantilla/Mock)');
  }

  async save(file: Express.Multer.File): Promise<StorageResult> {
    this.logger?.info(`[Supabase Storage Mock] Simulando subida de: ${file.originalname}`);

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const storedName = `supabase-mock-${uniqueSuffix}-${file.originalname}`;

    return {
      success: true,
      storedName,
      pathOrUrl: `https://supabase.co/storage/v1/object/public/uploads/${storedName}`,
      sizeBytes: file.size,
      provider: 'supabase (MOCK)'
    };
  }

  async delete(fileKey: string): Promise<void> {
    this.logger?.info(`[Supabase Storage Mock] Simulando eliminación de: ${fileKey}`);
  }
}
