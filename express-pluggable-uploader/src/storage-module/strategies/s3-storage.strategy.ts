import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { StorageStrategy, StorageResult } from '../interfaces/storage-strategy.interface';
import { StorageModuleConfig } from '../interfaces/storage-config.interface';
import { sanitizeFilename } from '../utils/filename.util';

export interface S3StorageConfig {
  bucketName: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  publicUrl?: string;
  logger?: StorageModuleConfig['logger'];
}

export class S3StorageStrategy implements StorageStrategy {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;
  private logger?: StorageModuleConfig['logger'];

  constructor(config: S3StorageConfig) {
    if (!config) {
      throw new Error('❌ S3StorageStrategy requiere configuraciones válidas en la inicialización.');
    }
    if (!config.bucketName || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error('❌ S3StorageStrategy requiere especificar [bucketName], [accessKeyId] y [secretAccessKey].');
    }

    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl || '';
    this.logger = config.logger;

    const endpoint = config.endpoint;
    const accessKeyId = config.accessKeyId;
    const secretAccessKey = config.secretAccessKey;
    const region = config.region || 'auto';

    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      forcePathStyle: !!endpoint
    });
  }

  async save(file: Express.Multer.File): Promise<StorageResult> {
    const startTime = Date.now();
    const sanitized = sanitizeFilename(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const storedName = `${uniqueSuffix}-${sanitized}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storedName,
      Body: file.buffer,
      ContentType: file.mimetype
    });

    await this.s3Client.send(command);

    const duration = Date.now() - startTime;
    this.logger?.info(`☁️ S3Storage: Archivo [${storedName}] subido con éxito en ${duration}ms`);

    const fileUrl = this.publicUrl
      ? `${this.publicUrl.replace(/\/$/, '')}/${storedName}`
      : `https://${this.bucketName}.s3.amazonaws.com/${storedName}`;

    return {
      success: true,
      storedName,
      pathOrUrl: fileUrl,
      sizeBytes: file.size,
      provider: 's3'
    };
  }

  async delete(fileKey: string): Promise<void> {
    const pureKey = path.basename(fileKey);

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: pureKey
    });

    await this.s3Client.send(command);
    this.logger?.info(`🗑️ S3Storage: Archivo [${pureKey}] eliminado de S3.`);
  }
}
