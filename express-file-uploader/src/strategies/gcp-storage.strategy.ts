import { StorageStrategy, StorageResult } from '../interfaces/storage-strategy.interface';

/**
 * Plantilla de Estrategia para Google Cloud Storage (GCP).
 * Muestra cómo se conectaría el SDK oficial (@google-cloud/storage) en esta arquitectura.
 */
export class GcpStorageStrategy implements StorageStrategy {
  constructor() {
    console.log('🔌 GcpStorageStrategy: Inicializado (Modo Plantilla/Mock)');
  }

  async save(file: Express.Multer.File): Promise<StorageResult> {
    console.log(`[Google Cloud Storage] Simulando subida de: ${file.originalname}`);
    
    // Aquí iría la lógica real usando el SDK:
    // const bucket = storage.bucket(bucketName);
    // const blob = bucket.file(fileName);
    // const blobStream = blob.createWriteStream({ resumable: false, contentType: file.mimetype });
    // blobStream.end(file.buffer);

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const storedName = `gcp-mock-${uniqueSuffix}-${file.originalname}`;

    return {
      success: true,
      storedName: storedName,
      pathOrUrl: `https://storage.googleapis.com/gcp-mock-bucket/${storedName}`,
      sizeBytes: file.size,
      provider: 'gcp (MOCK TEMPLATE)'
    };
  }

  async delete(fileKey: string): Promise<void> {
    console.log(`[Google Cloud Storage] Simulando eliminación de: ${fileKey}`);
    // Lógica real:
    // await storage.bucket(bucketName).file(fileKey).delete();
  }
}
