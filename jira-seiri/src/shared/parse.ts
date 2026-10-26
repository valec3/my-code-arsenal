import { SeiriError } from '../domain/errors';

export function parseThreshold(value: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new SeiriError('--threshold debe ser un entero entre 0 y 100', 'VALIDATION');
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed < 0 || parsed > 100) {
    throw new SeiriError('--threshold debe ser un entero entre 0 y 100', 'VALIDATION');
  }

  return parsed;
}
