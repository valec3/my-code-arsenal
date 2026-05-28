import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env.config';
import uploadRouter from './routes/upload.routes';
import { logger } from './utils/logger.util';

const app = express();
const PORT = env.PORT;

// Habilitación de CORS y parseo de peticiones JSON y URL encoded
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Montar las rutas modularizadas de almacenamiento en el namespace /api
app.use('/api', uploadRouter);

// Middleware Global de Manejo de Errores Críticos (no controlados)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err, '❌ Error no controlado detectado en la aplicación');
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor.'
  });
});

// Inicialización del Servidor
app.listen(PORT, () => {
  logger.info({
    url: `http://localhost:${PORT}/api`,
    health: `http://localhost:${PORT}/api/health`,
    provider: env.STORAGE_PROVIDER.toUpperCase(),
    maxSizeMb: (env.MAX_FILE_SIZE / (1024 * 1024)).toFixed(2)
  }, `🚀 Uploader Server inicializado con éxito y protegido contra abusos.`);
});
