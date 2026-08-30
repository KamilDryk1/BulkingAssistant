import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bodyKeys } from '@/features/body/body-query-keys';
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
    placeholderData: (previousData) => previousData,
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

function useInvalidateTodayAndBody() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: todayKeys.all }),
      queryClient.invalidateQueries({ queryKey: bodyKeys.all }),
    ]);
}

export function useSaveActivityLog() {
  const invalidateTodayAndBody = useInvalidateTodayAndBody();

  return useMutation({ mutationFn: saveActivityLog, onSuccess: invalidateTodayAndBody });
}

export function useDeleteActivityLog() {
  const invalidateTodayAndBody = useInvalidateTodayAndBody();

  return useMutation({ mutationFn: deleteActivityLog, onSuccess: invalidateTodayAndBody });
}

export function useSaveTodayWeight() {
  const invalidateTodayAndBody = useInvalidateTodayAndBody();

  return useMutation({
    mutationFn: (input: SaveTodayWeightInput) => saveTodayWeight(input),
    onSuccess: invalidateTodayAndBody,
  });
}
