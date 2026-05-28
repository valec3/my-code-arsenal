import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger.util';

/**
 * Middleware para limitar la tasa de peticiones en endpoints críticos de subida.
 * Limita por IP para evitar saturación de disco local o cuotas de R2/S3.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // Ventana de 1 minuto
  max: 15, // Límite máximo de 15 peticiones por ventana de tiempo por IP
  standardHeaders: true, // Retorna los headers RateLimit-* estándar
  legacyHeaders: false, // Deshabilita los headers X-RateLimit-* heredados
  message: {
    success: false,
    error: 'Demasiadas subidas de archivos desde esta dirección IP. Por favor, intentá de nuevo en 1 minuto.'
  },
  handler: (req: Request, res: Response, next, options) => {
    logger.warn({
      ip: req.ip,
      path: req.originalUrl,
      method: req.method
    }, `⚠️ LÍMITE DE TASA EXCEDIDO: IP ${req.ip} ha sido bloqueada temporalmente por exceso de subidas.`);
    
    res.status(429).json(options.message);
  }
});
