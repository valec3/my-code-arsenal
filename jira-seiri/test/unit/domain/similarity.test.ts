import { describe, expect, it } from 'vitest';
import {
  diceCoefficient,
  normalizeText,
  similarityPercent,
  trigrams,
} from '../../../src/domain/similarity';

describe('similarity', () => {
  it('normaliza mayusculas, acentos y puntuacion', () => {
    expect(normalizeText('  [ANÁLISIS] Redacción   preliminar ')).toBe(
      'analisis redaccion preliminar'
    );
  });

  it('da 100 a dos sumarios equivalentes salvo acentos', () => {
    expect(
      similarityPercent(
        '[ANÁLISIS] Redacción preliminar de cláusulas',
        '[analisis] redaccion preliminar de clausulas'
      )
    ).toBe(100);
  });

  it('da 0 cuando no comparten trigramas', () => {
    expect(diceCoefficient('abc', 'xyz')).toBe(0);
  });

  it('es simetrico', () => {
    const left = 'Configurar webhook de reportes';
    const right = 'Webhook para reportes automaticos';
    expect(diceCoefficient(left, right)).toBeCloseTo(diceCoefficient(right, left), 10);
  });

  it('castiga sumarios que solo comparten tema', () => {
    expect(
      similarityPercent(
        'Configurar webhook para reportes automaticos',
        'Redactar clausulas de consentimiento'
      )
    ).toBeLessThan(30);
  });

  it('maneja textos vacios de forma estable', () => {
    expect(trigrams('').size).toBe(0);
    expect(diceCoefficient('', '')).toBe(1);
    expect(diceCoefficient('', 'algo')).toBe(0);
  });
});
