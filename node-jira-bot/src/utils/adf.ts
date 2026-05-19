import { JiraADFDocument } from '../types/jira.types';

/**
 * Convierte una cadena de texto plano al estándar Atlassian Document Format (ADF).
 * La API REST v3 de Jira requiere descripciones estructuradas en este formato.
 * 
 * @param text Texto plano a convertir.
 * @returns Un documento estructurado ADF válido para Jira.
 */
export function convertPlaintextToADF(text: string): JiraADFDocument {
  const safeText = text || '';
  
  // Dividir por saltos de línea para soportar párrafos múltiples
  const paragraphs = safeText.split(/\r?\n/);
  
  return {
    version: 1,
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: p.trim().length > 0 
        ? [
            {
              type: 'text',
              text: p
            }
          ]
        : [] // Párrafo vacío si es una línea en blanco
    }))
  };
}
