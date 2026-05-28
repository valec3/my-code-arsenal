import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { StorageModule } from './storage-module';
import { LocalStorageStrategy } from './storage-module/strategies/local-storage.strategy';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servimos archivos estáticos de forma pública desde la carpeta uploads
app.use('/uploads', express.static('uploads'));

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);
const allowedMimetypes = (process.env.ALLOWED_MIMETYPES || 'image/png,image/jpeg,application/pdf')
  .split(',')
  .map(t => t.trim());

const customLogger = {
  info: (msg: string, ...args: any[]) => console.log(`🚀 [HOST] INFO: ${msg}`, ...args),
  error: (err: any, msg: string) => console.error(`❌ [HOST] ERROR: ${msg}`, err),
  warn: (msg: string, ...args: any[]) => console.warn(`⚠️ [HOST] WARN: ${msg}`, ...args)
};

console.log('🔌 Inicializando modulo de almacenamiento con LocalStorage...');
const localStrategy = new LocalStorageStrategy({
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  baseUrl: `http://localhost:${PORT}/uploads`,
  logger: customLogger
});

const storage = new StorageModule(localStrategy, {
  maxFileSize,
  allowedMimetypes,
  logger: customLogger
});

// Extraemos los middlewares de forma semántica imitando la interfaz nativa de Multer
const upload = storage.middlewares;

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    strategy: 'local'
  });
});

app.post('/api/upload', upload.single, async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'Por favor, proporciona un archivo en el campo "file".' });
    return;
  }

  try {
    const result = await storage.uploadFile(req.file);
    res.status(201).json({
      success: true,
      message: 'Archivo guardado exitosamente.',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/upload/multiple', upload.multiple, async (req: Request, res: Response, next: NextFunction) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ success: false, error: 'Por favor, proporciona archivos en el campo "files".' });
    return;
  }

  try {
    const uploadPromises = files.map(file => storage.uploadFile(file));
    const results = await Promise.all(uploadPromises);

    res.status(201).json({
      success: true,
      message: `${files.length} archivos subidos exitosamente.`,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/delete', async (req: Request, res: Response, next: NextFunction) => {
  const { key } = req.body;

  if (!key) {
    res.status(400).json({ success: false, error: 'Por favor, proporciona el "key" del archivo a eliminar.' });
    return;
  }

  try {
    await storage.deleteFile(key);
    res.json({
      success: true,
      message: `Archivo [${key}] eliminado con éxito.`
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('💥 Error Crítico No Controlado:', err);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    error: isDev ? err.message : 'Error interno del servidor.',
    stack: isDev ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`📡 Servidor Sandbox escuchando en http://localhost:${PORT}`);
});
