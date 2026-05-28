import path from 'path';

/**
 * Sanitiza el nombre de un archivo para que sea 100% seguro contra inyecciones y Directory Traversal.
 * Convierte el nombre a minúsculas, reemplaza espacios y caracteres no alfanuméricos por guiones.
 * 
 * @param originalName Nombre original del archivo (ej: "Mi Archivo / Raro..png")
 * @returns Nombre sanitizado y seguro
 */
export function sanitizeFilename(originalName: string): string {
  // Extraer la extensión y el nombre base de forma segura
  const fileExtension = path.extname(originalName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const baseName = path.basename(originalName, path.extname(originalName));

  // Sanitizar el nombre base:
  // 1. Decodificar caracteres URL si los hay
  let sanitized = decodeURIComponent(baseName);
  
  // 2. Convertir a minúsculas
  sanitized = sanitized.toLowerCase();
  
  // 3. Reemplazar caracteres especiales y espacios por un guión medio
  // Acepta solo letras, números, guión medio y guión bajo
  sanitized = sanitized.replace(/[^a-z0-9-_]/g, '-');
  
  // 4. Limpiar guiones duplicados (ej: "hola---mundo" -> "hola-mundo")
  sanitized = sanitized.replace(/-+/g, '-');
  
  // 5. Quitar guiones al principio o al final
  sanitized = sanitized.replace(/^-|-$/g, '');

  // Si después de limpiar el nombre quedó vacío (ej: si era un nombre chino o solo símbolos no permitidos)
  // le asignamos un nombre por defecto genérico
  if (!sanitized) {
    sanitized = 'uploaded-file';
  }

  // Si hay extensión válida, la unimos. De lo contrario, queda solo el nombre
  return fileExtension ? `${sanitized}.${fileExtension}` : sanitized;
}
