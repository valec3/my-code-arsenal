import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LocalStorageStrategy, LocalStorageConfig } from '../src/storage-module/strategies/local-storage.strategy';

describe('LocalStorageStrategy', () => {
  const testUploadDir = path.join(__dirname, 'temp-uploads-refactored');
  const config: LocalStorageConfig = {
    uploadDir: testUploadDir,
    logger: {
      info: () => {},
      error: () => {},
      warn: () => {}
    }
  };

  let strategy: LocalStorageStrategy;

  beforeAll(() => {
    strategy = new LocalStorageStrategy(config);
  });

  afterAll(async () => {
    // Limpiar el directorio temporal después de los tests
    if (fs.existsSync(testUploadDir)) {
      const files = await fs.promises.readdir(testUploadDir);
      for (const file of files) {
        await fs.promises.unlink(path.join(testUploadDir, file));
      }
      await fs.promises.rmdir(testUploadDir);
    }
  });

  it('debe guardar un archivo en el directorio local de manera exitosa', async () => {
    const mockFile = {
      originalname: 'foto-perfil.png',
      mimetype: 'image/png',
      buffer: Buffer.from('contenido-falso-de-imagen'),
      size: 25
    } as Express.Multer.File;

    const result = await strategy.save(mockFile);

    expect(result.success).toBe(true);
    expect(result.sizeBytes).toBe(25);
    expect(result.provider).toBe('local');
    expect(result.storedName).toContain('foto-perfil.png');
    
    // Verificar que físicamente existe en el disco
    const filePath = path.join(testUploadDir, result.storedName);
    expect(fs.existsSync(filePath)).toBe(true);

    // Limpieza individual
    await strategy.delete(result.storedName);
  });

  it('debe arrojar un error si intentamos eliminar un archivo que no existe', async () => {
    await expect(strategy.delete('archivo-inexistente.png')).rejects.toThrow();
  });

  it('debe proteger contra inyección de rutas (Path Traversal) en la eliminación', async () => {
    const dangerousKey = '../../archivo-critico.txt';

    await expect(strategy.delete(dangerousKey)).rejects.toThrow(
      'Archivo no encontrado en almacenamiento local: archivo-critico.txt'
    );
  });
});
