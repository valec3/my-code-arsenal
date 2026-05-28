import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageStrategy } from './core/strategies/local-storage.strategy';

describe('StorageService (NestJS Provider)', () => {
  let service: StorageService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'STORAGE_PROVIDER') return 'local';
        if (key === 'UPLOAD_DIR') return './test-uploads-nestjs';
        if (key === 'MAX_FILE_SIZE') return '5242880'; // 5MB
        if (key === 'ALLOWED_MIMETYPES') return 'image/png,image/jpeg';
        return defaultValue;
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ]
    }).compile();

    service = module.get<StorageService>(StorageService);
    // Ejecutar de forma sincrónica el ciclo de vida
    service.onModuleInit();
  });

  it('debe estar definido y correctamente instanciado', () => {
    expect(service).toBeDefined();
    expect(service.activeStrategy).toBeInstanceOf(LocalStorageStrategy);
    expect(service.middlewares).toBeDefined();
  });

  it('debe delegar la llamada de subida de archivos a la estrategia activa', async () => {
    const mockFile = {
      originalname: 'test.png',
      mimetype: 'image/png',
      buffer: Buffer.from('abc'),
      size: 3
    } as Express.Multer.File;

    const spy = jest.spyOn(service.activeStrategy, 'save').mockResolvedValue({
      success: true,
      storedName: 'mock-test.png',
      pathOrUrl: 'http://localhost:3000/uploads/mock-test.png',
      sizeBytes: 3,
      provider: 'local'
    });

    const result = await service.uploadFile(mockFile);

    expect(result.success).toBe(true);
    expect(result.storedName).toBe('mock-test.png');
    expect(spy).toHaveBeenCalledWith(mockFile);
    
    spy.mockRestore();
  });
});
