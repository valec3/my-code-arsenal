import pino from 'pino';

// En desarrollo, usamos pino-pretty para que los logs se lean de forma súper hermosa en la terminal.
// En producción, pino escribe en formato JSON de alta velocidad de forma nativa.
const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
