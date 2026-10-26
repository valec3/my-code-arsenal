export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function trigrams(value: string): Set<string> {
  const normalized = normalizeText(value);
  if (!normalized) {
    return new Set<string>();
  }

  const padded = ` ${normalized} `;
  const result = new Set<string>();

  for (let index = 0; index + 3 <= padded.length; index++) {
    result.add(padded.slice(index, index + 3));
  }

  return result;
}

export function diceCoefficient(left: string, right: string): number {
  const a = trigrams(left);
  const b = trigrams(right);

  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const gram of a) {
    if (b.has(gram)) {
      shared++;
    }
  }

  return (2 * shared) / (a.size + b.size);
}

export function similarityPercent(left: string, right: string): number {
  return Math.round(diceCoefficient(left, right) * 100);
}
