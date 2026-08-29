const poundsPerKilogram = 2.2046226218;

export function kilogramsToPounds(kilograms: number) {
  return kilograms * poundsPerKilogram;
}

export function poundsToKilograms(pounds: number) {
  return pounds / poundsPerKilogram;
}

export function normalizeDecimalInput(value: string) {
  return Number(value.trim().replace(',', '.'));
}
