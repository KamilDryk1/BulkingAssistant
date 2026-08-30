import type { AppLocale, WeightUnit } from '@/types/database';

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

export function convertWeightForDisplay(weightKg: number, unit: WeightUnit) {
  return unit === 'lb' ? kilogramsToPounds(weightKg) : weightKg;
}

export function formatLocalizedWeight(
  weightKg: number,
  unit: WeightUnit,
  locale: AppLocale,
  fractionDigits = 1,
) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(convertWeightForDisplay(weightKg, unit));
}

export function formatLocalizedWeightChange(
  weightKg: number,
  unit: WeightUnit,
  locale: AppLocale,
  fractionDigits = 1,
) {
  const displayWeight = convertWeightForDisplay(weightKg, unit);
  const sign = displayWeight > 0 ? '+' : displayWeight < 0 ? '−' : '';

  return `${sign}${new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(Math.abs(displayWeight))}`;
}

export function formatBodyWeight(weightKg: number, unit: WeightUnit) {
  const displayWeight = convertWeightForDisplay(weightKg, unit);

  return Number(displayWeight.toFixed(1)).toString();
}
