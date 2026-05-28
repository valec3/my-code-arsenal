import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { StorageStrategy, StorageResult } from '../interfaces/storage-strategy.interface';
import { env } from '../config/env.config';
import { sanitizeFilename } from '../utils/filename.util';
import { logger } from '../utils/logger.util';

export class S3StorageStrategy implements StorageStrategy {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    this.bucketName = env.S3_BUCKET_NAME!;
    this.publicUrl = env.S3_PUBLIC_URL || ''; 

    const endpoint = env.S3_ENDPOINT; 
    const accessKeyId = env.S3_ACCESS_KEY_ID!;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY!;
    const region = env.S3_REGION || 'auto';

    // Configurar cliente de S3/R2
    this.s3Client = new S3Client({
      region: region,
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: endpoint ? true : false,
    });
  }

  async save(file: Express.Multer.File): Promise<StorageResult> {
    const startTime = Date.now();
    // Sanitizar el nombre original
    const sanitized = sanitizeFilename(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const storedName = `${uniqueSuffix}-${sanitized}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storedName,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3Client.send(command);

    const duration = Date.now() - startTime;
    logger.info({
      storedName,
      originalName: file.originalname,
      sizeBytes: file.size,
      durationMs: duration
    }, `☁️ S3Storage: Archivo subido con éxito en ${duration}ms`);

    // Si hay una URL pública configurada (por ejemplo, dominio de Cloudflare o CDN), la usamos.
    // De lo contrario, retornamos un esquema base.
    const fileUrl = this.publicUrl 
      ? `${this.publicUrl.replace(/\/$/, '')}/${storedName}`
      : `https://${this.bucketName}.s3.${env.S3_REGION}.amazonaws.com/${storedName}`;

    return {
      success: true,
      storedName: storedName,
      pathOrUrl: fileUrl,
      sizeBytes: file.size,
      provider: 'r2/s3'
    };
  }

  async delete(fileKey: string): Promise<void> {
    // Extraer la clave pura del archivo si se pasa una URL completa
    const pureKey = path.basename(fileKey);

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: pureKey,
    });

    await this.s3Client.send(command);
  }
}
