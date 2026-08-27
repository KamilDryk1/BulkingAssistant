import type { SupportedLocale } from '@/i18n';

export function formatFullDate(date: Date, locale: SupportedLocale) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(date);
}
