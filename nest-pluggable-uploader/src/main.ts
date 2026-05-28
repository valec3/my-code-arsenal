import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS
  app.enableCors();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  
  logger.log(`🚀 nest-pluggable-uploader escuchando en http://localhost:${port}`);
  logger.log(`🩺 Healthcheck y Sandbox: http://localhost:${port}/api/upload`);
  logger.log(`💾 Estrategia de almacenamiento activa: [${configService.get<string>('STORAGE_PROVIDER', 'local').toUpperCase()}]`);
}
bootstrap();
