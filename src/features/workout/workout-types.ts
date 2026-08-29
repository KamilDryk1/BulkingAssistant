import type {
  PreviousExercisePerformanceRow,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from '@/types/database';

export type PreviousExercisePerformance = {
  date: string;
  sets: PreviousExercisePerformanceRow[];
};

export type WorkoutSessionExercise = WorkoutSessionExerciseRow & {
  previousPerformance: PreviousExercisePerformance | null;
  sets: WorkoutSetRow[];
};

export type WorkoutSessionDetails = {
  exercises: WorkoutSessionExercise[];
  session: WorkoutSessionRow;
};

export type WorkoutHistoryItem = WorkoutSessionRow & {
  completedSetCount: number;
  exerciseCount: number;
  exerciseNames: string[];
};

export type WorkoutHistoryPage = {
  items: WorkoutHistoryItem[];
  nextPage: number | null;
};

export type SaveWorkoutSetInput = {
  completed: boolean;
  reps: number;
  sessionExerciseId: string;
  weightKg: number;
  workoutSetId: string | null;
};
