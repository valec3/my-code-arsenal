import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { StorageModuleNest } from './common/storage/storage.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    // Habilitar variables de entorno de forma global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    
    // Servir la carpeta local uploads de forma pública
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads'
    }),
    
    // Registrar nuestro módulo global de almacenamiento
    StorageModuleNest,
    
    // Módulo del controlador sandbox
    UploadModule
  ]
})
export class AppModule {}
