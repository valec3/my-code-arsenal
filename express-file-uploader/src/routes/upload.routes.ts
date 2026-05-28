import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller';
import { uploadSingleFile, uploadMultipleFiles } from '../middlewares/multer.middleware';
import { uploadRateLimiter } from '../middlewares/rate-limiter.middleware';

const router = Router();
const controller = new UploadController();

// Ruta de Healthcheck (Pública)
router.get('/health', controller.healthCheck);

// Ruta declarativa para subir archivo individual (Protegida)
router.post('/upload', uploadRateLimiter, uploadSingleFile, controller.uploadSingle);

// Ruta declarativa para subir múltiples archivos (Protegida)
router.post('/upload/multiple', uploadRateLimiter, uploadMultipleFiles, controller.uploadMultiple);

// Ruta para eliminar un archivo del storage activo (Protegida)
router.post('/delete', uploadRateLimiter, controller.deleteFile);

export default router;
