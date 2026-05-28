import path from 'path';

/**
 * Sanitiza el nombre de un archivo para hacerlo seguro contra directory traversal e inyecciones.
 */
export function sanitizeFilename(originalName: string): string {
  const fileExtension = path.extname(originalName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const baseName = path.basename(originalName, path.extname(originalName));

  let sanitized = decodeURIComponent(baseName);
  sanitized = sanitized.toLowerCase();
  sanitized = sanitized.replace(/[^a-z0-9-_]/g, '-');
  sanitized = sanitized.replace(/-+/g, '-');
  sanitized = sanitized.replace(/^-|-$/g, '');

  if (!sanitized) {
    sanitized = 'uploaded-file';
  }

  return fileExtension ? `${sanitized}.${fileExtension}` : sanitized;
}
