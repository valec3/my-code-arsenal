import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageModule } from './core';
import { StorageResult } from './core/interfaces/storage-strategy.interface';

@Injectable()
export class StorageService implements OnModuleInit {
  private uploader!: StorageModule;
  private readonly logger = new Logger('StorageService');

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const provider = this.configService.get<string>('STORAGE_PROVIDER', 'local');
    const maxFileSize = parseInt(this.configService.get<string>('MAX_FILE_SIZE', '10485760'), 10);
    const rawMimetypes = this.configService.get<string>('ALLOWED_MIMETYPES', 'image/png,image/jpeg,application/pdf');
    const allowedMimetypes = rawMimetypes.split(',').map(t => t.trim());

    const customLogger = {
      info: (msg: string, ...args: any[]) => this.logger.log(`${msg} ${args.length ? JSON.stringify(args) : ''}`),
      error: (err: any, msg: string) => this.logger.error(msg, err),
      warn: (msg: string, ...args: any[]) => this.logger.warn(`${msg} ${args.length ? JSON.stringify(args) : ''}`)
    };

    let strategy;

    switch (provider) {
      case 's3':
        throw new Error('❌ S3StorageStrategy no está instalada en este build para evitar dependencias redundantes.');

      case 'gcp':
        const { GcpStorageStrategy } = require('./core/strategies/gcp-storage.strategy') as typeof import('./core/strategies/gcp-storage.strategy');
        strategy = new GcpStorageStrategy({
          projectId: this.configService.getOrThrow<string>('GCP_PROJECT_ID'),
          bucketName: this.configService.getOrThrow<string>('GCP_BUCKET_NAME'),
          logger: customLogger
        });
        break;

      case 'supabase':
        const { SupabaseStorageStrategy } = require('./core/strategies/supabase-storage.strategy') as typeof import('./core/strategies/supabase-storage.strategy');
        strategy = new SupabaseStorageStrategy({
          url: this.configService.getOrThrow<string>('SUPABASE_URL'),
          anonKey: this.configService.getOrThrow<string>('SUPABASE_ANON_KEY'),
          logger: customLogger
        });
        break;

      case 'local':
      default:
        const { LocalStorageStrategy } = require('./core/strategies/local-storage.strategy') as typeof import('./core/strategies/local-storage.strategy');
        strategy = new LocalStorageStrategy({
          uploadDir: this.configService.get<string>('UPLOAD_DIR', './uploads'),
          baseUrl: `${this.configService.get<string>('APP_URL', 'http://localhost:3000')}/uploads`,
          logger: customLogger
        });
        break;
    }

    this.uploader = new StorageModule(strategy, {
      maxFileSize,
      allowedMimetypes,
      logger: customLogger
    });
  }

  public get activeStrategy() {
    return this.uploader.activeStrategy;
  }

  public get middlewares() {
    return this.uploader.middlewares;
  }

  public async uploadFile(file: Express.Multer.File): Promise<StorageResult> {
    return this.uploader.uploadFile(file);
  }

  public async deleteFile(fileKey: string): Promise<void> {
    return this.uploader.deleteFile(fileKey);
  }
}
