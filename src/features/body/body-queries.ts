import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { bodyKeys } from './body-query-keys';
import { fetchActivityHistory, fetchBodyData } from './body-service';
import type { ActivityHistoryPage } from './body-types';

export function useBodyData(userId: string, date: string) {
  return useQuery({
    enabled: Boolean(userId && date),
    queryFn: () => fetchBodyData(userId, date),
    queryKey: bodyKeys.overview(userId, date),
  });
}

export function useActivityHistory(userId: string) {
  return useInfiniteQuery({
    enabled: Boolean(userId),
    getNextPageParam: (lastPage: ActivityHistoryPage) => lastPage.nextPage ?? undefined,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchActivityHistory(userId, pageParam),
    queryKey: bodyKeys.activityHistory(userId),
  });
}
