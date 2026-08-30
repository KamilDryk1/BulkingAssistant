import type { AppLocale } from '@/types/database';

export type ProgressMode = 'estimatedOneRepMax' | 'bestSet';

export type ProgressExercise = {
  displayName: string;
  id: string;
  latestSessionAt: string;
};

export type ProgressSetSource = {
  completedAt: string | null;
  exerciseId: string;
  reps: number;
  sessionDate: string;
  sessionId: string;
  sessionStartedAt: string;
  setId: string;
  weightKg: number;
};

export type ProgressData = {
  exercises: ProgressExercise[];
  locale: AppLocale;
  sets: ProgressSetSource[];
};

export type ProgressSet = {
  reps: number;
  setId: string;
  weightKg: number;
};

export type ProgressSessionPoint = {
  bestSet: ProgressSet;
  date: string;
  estimatedOneRepMaxKg: number;
  estimatedOneRepMaxSet: ProgressSet;
  occurredAt: string;
  sessionId: string;
};

export type ProgressChartPoint = {
  date: string;
  occurredAt: string;
  reps: number;
  sessionId: string;
  valueKg: number;
  weightKg: number;
};

export type ProgressTrend = { kind: 'weight'; valueKg: number } | { kind: 'reps'; value: number };

export type ProgressSummary = {
  current: ProgressChartPoint | null;
  points: ProgressChartPoint[];
  trend: ProgressTrend | null;
};
