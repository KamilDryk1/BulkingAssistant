import { useQuery } from '@tanstack/react-query';

import type { AppLocale } from '@/types/database';

import { progressKeys } from './progress-query-keys';
import { fetchProgressData } from './progress-service';

export function useProgressData(userId: string, locale: AppLocale, date: string) {
  return useQuery({
    enabled: Boolean(userId && date),
    queryFn: () => fetchProgressData(userId, locale, date),
    queryKey: progressKeys.data(userId, locale, date),
  });
}
