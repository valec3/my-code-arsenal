import { StorageStrategy, StorageResult } from '../interfaces/storage-strategy.interface';

/**
 * Plantilla de Estrategia para Supabase Storage.
 * Muestra cómo se conectaría el SDK de Supabase en esta arquitectura limpia.
 */
export class SupabaseStorageStrategy implements StorageStrategy {
  constructor() {
    console.log('🔌 SupabaseStorageStrategy: Inicializado (Modo Plantilla/Mock)');
  }

  async save(file: Express.Multer.File): Promise<StorageResult> {
    console.log(`[Supabase Storage] Simulando subida de: ${file.originalname}`);
    
    // Aquí iría la lógica real usando el SDK:
    // const { data, error } = await supabase.storage.from('bucket').upload(path, file.buffer, { contentType: file.mimetype });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const storedName = `supabase-mock-${uniqueSuffix}-${file.originalname}`;

    return {
      success: true,
      storedName: storedName,
      pathOrUrl: `https://supabase.co/storage/v1/object/public/uploads/${storedName}`,
      sizeBytes: file.size,
      provider: 'supabase (MOCK TEMPLATE)'
    };
  }

  async delete(fileKey: string): Promise<void> {
    console.log(`[Supabase Storage] Simulando eliminación de: ${fileKey}`);
    // Lógica real:
    // await supabase.storage.from('bucket').remove([fileKey]);
  }
}
