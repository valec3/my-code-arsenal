import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../common/storage/storage.service';

@Controller('api')
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Por favor, proporciona un archivo en el campo "file".');
    }

    const result = await this.storageService.uploadFile(file);
    return {
      success: true,
      message: 'Archivo procesado y subido de manera exitosa en NestJS.',
      data: result
    };
  }

  @Post('upload/multiple')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Por favor, proporciona al menos un archivo en el campo "files".');
    }

    const uploadPromises = files.map(file => this.storageService.uploadFile(file));
    const results = await Promise.all(uploadPromises);

    return {
      success: true,
      message: `${files.length} archivos subidos con éxito en paralelo.`,
      data: results
    };
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  async deleteFile(@Body('key') key: string) {
    if (!key) {
      throw new BadRequestException('Por favor, proporciona el "key" o nombre del archivo a eliminar.');
    }

    await this.storageService.deleteFile(key);
    return {
      success: true,
      message: `Archivo [${key}] eliminado de manera exitosa.`
    };
  }
}
