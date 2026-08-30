import type { AppLocale } from '@/types/database';

export const progressKeys = {
  all: ['progress'] as const,
  data: (userId: string, locale: AppLocale, date: string) =>
    [...progressKeys.all, 'data', userId, locale, date] as const,
};
