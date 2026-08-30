import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { todayKeys } from '@/features/today/today-queries';
import type { AppLocale } from '@/types/database';

import {
  createCustomActivity,
  createCustomExercise,
  deleteCustomExercise,
  deleteDailyScheduleOverride,
  deleteWorkoutPlan,
  fetchDailyScheduleOverride,
  fetchTrainingData,
  replaceDailyScheduleOverride,
  replaceWeeklyScheduleDay,
  saveWorkoutPlan,
} from './training-service';
import type {
  CreateCustomActivityInput,
  CreateCustomExerciseInput,
  SaveWorkoutPlanInput,
  ScheduleDraftItem,
} from './training-types';

export const trainingKeys = {
  all: ['training'] as const,
  dailyOverride: (userId: string, date: string) =>
    [...trainingKeys.all, 'daily-override', userId, date] as const,
  data: (userId: string, locale: AppLocale) =>
    [...trainingKeys.all, 'data', userId, locale] as const,
};

export function useTrainingData(userId: string, locale: AppLocale) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: () => fetchTrainingData(userId, locale),
    queryKey: trainingKeys.data(userId, locale),
  });
}

export function useDailyScheduleOverride(userId: string, date: string) {
  return useQuery({
    enabled: Boolean(userId && date),
    queryFn: () => fetchDailyScheduleOverride(userId, date),
    queryKey: trainingKeys.dailyOverride(userId, date),
  });
}

function useInvalidateTraining() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: trainingKeys.all });
}

function useInvalidateTrainingAndToday() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trainingKeys.all }),
      queryClient.invalidateQueries({ queryKey: todayKeys.all }),
    ]);
}

export function useCreateCustomExercise() {
  const invalidateTraining = useInvalidateTraining();

  return useMutation({
    mutationFn: (input: CreateCustomExerciseInput) => createCustomExercise(input),
    onSuccess: invalidateTraining,
  });
}

export function useCreateCustomActivity() {
  const invalidateTraining = useInvalidateTraining();

  return useMutation({
    mutationFn: (input: CreateCustomActivityInput) => createCustomActivity(input),
    onSuccess: invalidateTraining,
  });
}

export function useDeleteCustomExercise() {
  const invalidateTraining = useInvalidateTraining();

  return useMutation({
    mutationFn: (exerciseId: string) => deleteCustomExercise(exerciseId),
    onSuccess: invalidateTraining,
  });
}

export function useSaveWorkoutPlan() {
  const invalidateTrainingAndToday = useInvalidateTrainingAndToday();

  return useMutation({
    mutationFn: (input: SaveWorkoutPlanInput) => saveWorkoutPlan(input),
    onSuccess: invalidateTrainingAndToday,
  });
}

export function useDeleteWorkoutPlan() {
  const invalidateTrainingAndToday = useInvalidateTrainingAndToday();

  return useMutation({
    mutationFn: (planId: string) => deleteWorkoutPlan(planId),
    onSuccess: invalidateTrainingAndToday,
  });
}

export function useReplaceWeeklyScheduleDay() {
  const invalidateTrainingAndToday = useInvalidateTrainingAndToday();

  return useMutation({
    mutationFn: ({ items, weekday }: { items: ScheduleDraftItem[]; weekday: number }) =>
      replaceWeeklyScheduleDay(weekday, items),
    onSuccess: invalidateTrainingAndToday,
  });
}

export function useReplaceDailyScheduleOverride(userId: string, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: ScheduleDraftItem[]) => replaceDailyScheduleOverride(date, items),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trainingKeys.dailyOverride(userId, date),
        }),
        queryClient.invalidateQueries({ queryKey: todayKeys.all }),
      ]);
    },
  });
}

export function useDeleteDailyScheduleOverride(userId: string, date: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteDailyScheduleOverride(date),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trainingKeys.dailyOverride(userId, date),
        }),
        queryClient.invalidateQueries({ queryKey: todayKeys.all }),
      ]);
    },
  });
}
