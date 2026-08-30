import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { progressKeys } from '@/features/progress/progress-query-keys';
import { trainingKeys } from '@/features/training/training-queries';
import { todayKeys } from '@/features/today/today-queries';

import {
  deleteWorkoutSet,
  fetchActiveWorkoutSession,
  fetchWorkoutHistory,
  fetchWorkoutSessionDetails,
  finishWorkoutSession,
  saveWorkoutSet,
  startWorkoutSession,
} from './workout-service';
import type { SaveWorkoutSetInput, WorkoutHistoryPage } from './workout-types';

export const workoutKeys = {
  active: (userId: string) => [...workoutKeys.all, 'active', userId] as const,
  all: ['workouts'] as const,
  detail: (userId: string, sessionId: string) =>
    [...workoutKeys.all, 'detail', userId, sessionId] as const,
  history: (userId: string) => [...workoutKeys.all, 'history', userId] as const,
};

export function useActiveWorkoutSession(userId: string) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: () => fetchActiveWorkoutSession(userId),
    queryKey: workoutKeys.active(userId),
  });
}

export function useWorkoutSessionDetails(userId: string, sessionId: string) {
  return useQuery({
    enabled: Boolean(userId && sessionId),
    queryFn: () => fetchWorkoutSessionDetails(userId, sessionId),
    queryKey: workoutKeys.detail(userId, sessionId),
  });
}

export function useWorkoutHistory(userId: string) {
  return useInfiniteQuery({
    enabled: Boolean(userId),
    getNextPageParam: (lastPage: WorkoutHistoryPage) => lastPage.nextPage ?? undefined,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchWorkoutHistory(userId, pageParam),
    queryKey: workoutKeys.history(userId),
  });
}

export function useStartWorkoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => startWorkoutSession(planId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useSaveWorkoutSet(userId: string, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveWorkoutSetInput) => saveWorkoutSet(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workoutKeys.detail(userId, sessionId) });
    },
  });
}

export function useDeleteWorkoutSet(userId: string, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (setId: string) => deleteWorkoutSet(setId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workoutKeys.detail(userId, sessionId) });
    },
  });
}

export function useFinishWorkoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => finishWorkoutSession(sessionId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
        queryClient.invalidateQueries({ queryKey: progressKeys.all }),
        queryClient.invalidateQueries({ queryKey: trainingKeys.all }),
        queryClient.invalidateQueries({ queryKey: todayKeys.all }),
      ]);
    },
  });
}
