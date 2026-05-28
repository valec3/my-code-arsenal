import { describe, it, expect } from 'vitest';
import { StorageModule } from '../src/storage-module/storage.orchestrator';
import { StorageModuleConfig } from '../src/storage-module/interfaces/storage-config.interface';
import { StorageStrategy, StorageResult } from '../src/storage-module/interfaces/storage-strategy.interface';

class MockStorageStrategy implements StorageStrategy {
  async save(file: Express.Multer.File): Promise<StorageResult> {
    return {
      success: true,
      storedName: 'mock-' + file.originalname,
      pathOrUrl: 'https://mock.com/' + file.originalname,
      sizeBytes: file.size,
      provider: 'mock'
    };
  }
  async delete(fileKey: string): Promise<void> {}
}

describe('StorageModule (Orquestador - Inyeccion de Estrategias)', () => {
  const mockStrategy = new MockStorageStrategy();
  const validConfig: StorageModuleConfig = {
    maxFileSize: 5 * 1024 * 1024,
    allowedMimetypes: ['image/png', 'image/jpeg'],
    logger: {
      info: () => {},
      error: () => {},
      warn: () => {}
    }
  };

  it('debe inicializarse exitosamente con una estrategia inyectada válida', () => {
    const storage = new StorageModule(mockStrategy, validConfig);
    
    expect(storage).toBeDefined();
    expect(storage.activeStrategy).toBe(mockStrategy);
    expect(storage.middlewares.single).toBeInstanceOf(Function);
    expect(storage.middlewares.multiple).toBeInstanceOf(Function);
  });

  it('debe reventar si no se le pasa una estrategia', () => {
    expect(() => new StorageModule(null as any, validConfig)).toThrow(
      'StorageModule requiere una estrategia de almacenamiento válida.'
    );
  });

  it('debe reventar si maxFileSize es menor o igual a cero', () => {
    const invalidConfig = {
      maxFileSize: 0,
      allowedMimetypes: ['image/png']
    } as any;

    expect(() => new StorageModule(mockStrategy, invalidConfig)).toThrow(
      'StorageModule requiere un [maxFileSize] positivo en bytes.'
    );
  });

  it('debe reventar si allowedMimetypes está vacío o indefinido', () => {
    const invalidConfig = {
      maxFileSize: 1024,
      allowedMimetypes: []
    } as any;

    expect(() => new StorageModule(mockStrategy, invalidConfig)).toThrow(
      'StorageModule requiere al menos un tipo en [allowedMimetypes].'
    );
  });

  it('debe delegar el guardado y eliminación en la estrategia inyectada', async () => {
    const storage = new StorageModule(mockStrategy, validConfig);
    const mockFile = {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      buffer: Buffer.from('abc'),
      size: 3
    } as Express.Multer.File;

    const result = await storage.uploadFile(mockFile);
    expect(result.success).toBe(true);
    expect(result.storedName).toBe('mock-avatar.png');
    expect(result.provider).toBe('mock');
  });
});
