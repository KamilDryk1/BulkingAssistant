import {
  kilogramsToPounds,
  normalizeDecimalInput,
  poundsToKilograms,
} from '@/features/units/weight';
import type { WeightUnit, WorkoutSetRow } from '@/types/database';

export function getElapsedSeconds(
  startedAt: string,
  completedAt?: string | null,
  now = Date.now(),
) {
  const startTime = new Date(startedAt).getTime();
  const endTime = completedAt ? new Date(completedAt).getTime() : now;

  return Math.max(0, Math.floor((endTime - startTime) / 1000));
}

export function formatElapsedTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getCalendarDayDifference(laterDateKey: string, earlierDateKey: string) {
  const [laterYear, laterMonth, laterDay] = laterDateKey.split('-').map(Number);
  const [earlierYear, earlierMonth, earlierDay] = earlierDateKey.split('-').map(Number);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.max(
    0,
    Math.round(
      (Date.UTC(laterYear, laterMonth - 1, laterDay) -
        Date.UTC(earlierYear, earlierMonth - 1, earlierDay)) /
        millisecondsPerDay,
    ),
  );
}

export function getInitialExerciseIndex(exercises: { sets: WorkoutSetRow[] }[]) {
  const unfinishedIndex = exercises.findIndex(
    (exercise) =>
      exercise.sets.length === 0 || exercise.sets.some((set) => set.completed_at === null),
  );

  return unfinishedIndex >= 0 ? unfinishedIndex : Math.max(0, exercises.length - 1);
}

export function formatWorkoutWeight(weightKg: number, unit: WeightUnit) {
  const displayWeight = unit === 'lb' ? kilogramsToPounds(weightKg) : weightKg;
  return Number(displayWeight.toFixed(2)).toString();
}

export function formatWorkoutDate(dateKey: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00`));
}

export function getLocalWorkoutDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseWorkoutSetInput(weightInput: string, repsInput: string, unit: WeightUnit) {
  const displayWeight = normalizeDecimalInput(weightInput);
  const reps = Number(repsInput.trim());

  if (!Number.isFinite(displayWeight) || displayWeight < 0) {
    return { error: 'weight' as const, value: null };
  }

  if (!Number.isInteger(reps) || reps <= 0) {
    return { error: 'reps' as const, value: null };
  }

  return {
    error: null,
    value: {
      reps,
      weightKg: unit === 'lb' ? poundsToKilograms(displayWeight) : displayWeight,
    },
  };
}
