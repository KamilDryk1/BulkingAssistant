import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProfileRow } from '@/types/database';

import {
  deleteActivityLog,
  fetchLastCompletedWorkoutDates,
  fetchTodayData,
  saveActivityLog,
  saveTodayWeight,
} from './today-service';
import type { SaveTodayWeightInput } from './today-types';

export const todayKeys = {
  all: ['today'] as const,
  data: (userId: string, date: string, profileUpdatedAt: string) =>
    [...todayKeys.all, 'data', userId, date, profileUpdatedAt] as const,
  lastWorkouts: (userId: string, date: string, planIds: readonly string[]) =>
    [...todayKeys.all, 'last-workouts', userId, date, [...planIds].sort()] as const,
};

export function useTodayData(userId: string, date: string, profile: ProfileRow | null) {
  return useQuery({
    enabled: Boolean(userId && date && profile),
    queryFn: () => fetchTodayData(userId, date, profile!),
    queryKey: todayKeys.data(userId, date, profile?.updated_at ?? ''),
  });
}

export function useLastCompletedWorkoutDates(
  userId: string,
  date: string,
  planIds: readonly string[],
) {
  return useQuery({
    enabled: Boolean(userId && date && planIds.length > 0),
    queryFn: () => fetchLastCompletedWorkoutDates(userId, planIds, date),
    queryKey: todayKeys.lastWorkouts(userId, date, planIds),
  });
}

function useInvalidateToday() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: todayKeys.all });
}

export function useSaveActivityLog() {
  const invalidateToday = useInvalidateToday();

  return useMutation({ mutationFn: saveActivityLog, onSuccess: invalidateToday });
}

export function useDeleteActivityLog() {
  const invalidateToday = useInvalidateToday();

  return useMutation({ mutationFn: deleteActivityLog, onSuccess: invalidateToday });
}

export function useSaveTodayWeight() {
  const invalidateToday = useInvalidateToday();

  return useMutation({
    mutationFn: (input: SaveTodayWeightInput) => saveTodayWeight(input),
    onSuccess: invalidateToday,
  });
}
