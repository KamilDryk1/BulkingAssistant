import { getExerciseDisplayName } from '@/features/training/training-domain';
import { getSupabaseClient } from '@/services/supabase/get-client';
import type {
  AppLocale,
  ExerciseRow,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from '@/types/database';

import { getProgressPeriodStartDate } from './progress-domain';
import type { ProgressData, ProgressSetSource } from './progress-types';

const queryChunkSize = 100;

function chunkValues<T>(values: readonly T[], size = queryChunkSize) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchSessionExercises(sessionIds: readonly string[]) {
  const results = await Promise.all(
    chunkValues(sessionIds).map((ids) =>
      getSupabaseClient()
        .from('workout_session_exercises')
        .select('*')
        .in('workout_session_id', ids),
    ),
  );
  const error = results.map((result) => result.error).find(Boolean);
  if (error) {
    throw error;
  }

  return results.flatMap((result) => result.data ?? []) as WorkoutSessionExerciseRow[];
}

async function fetchCompletedSets(sessionExerciseIds: readonly string[]) {
  const results = await Promise.all(
    chunkValues(sessionExerciseIds).map((ids) =>
      getSupabaseClient()
        .from('workout_sets')
        .select('*')
        .in('session_exercise_id', ids)
        .not('completed_at', 'is', null),
    ),
  );
  const error = results.map((result) => result.error).find(Boolean);
  if (error) {
    throw error;
  }

  return results.flatMap((result) => result.data ?? []) as WorkoutSetRow[];
}

async function fetchExercises(exerciseIds: readonly string[]) {
  if (exerciseIds.length === 0) {
    return [];
  }

  const { data, error } = await getSupabaseClient()
    .from('exercises')
    .select('*')
    .in('id', [...exerciseIds]);

  if (error) {
    throw error;
  }

  return (data ?? []) as ExerciseRow[];
}

export async function fetchProgressData(
  userId: string,
  locale: AppLocale,
  date: string,
): Promise<ProgressData> {
  const { data: sessions, error: sessionsError } = await getSupabaseClient()
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('session_date', getProgressPeriodStartDate(date))
    .lte('session_date', date)
    .order('started_at');

  if (sessionsError) {
    throw sessionsError;
  }

  const completedSessions = (sessions ?? []) as WorkoutSessionRow[];
  if (completedSessions.length === 0) {
    return { exercises: [], locale, sets: [] };
  }

  const sessionExercises = await fetchSessionExercises(
    completedSessions.map((session) => session.id),
  );
  const completedSets = await fetchCompletedSets(sessionExercises.map((exercise) => exercise.id));
  const exerciseBySessionExerciseId = new Map(
    sessionExercises.map((exercise) => [exercise.id, exercise]),
  );
  const sessionById = new Map(completedSessions.map((session) => [session.id, session]));
  const sets: ProgressSetSource[] = completedSets.flatMap((set) => {
    const sessionExercise = exerciseBySessionExerciseId.get(set.session_exercise_id);
    const session = sessionExercise ? sessionById.get(sessionExercise.workout_session_id) : null;

    if (!sessionExercise?.exercise_id || !session) {
      return [];
    }

    return [
      {
        completedAt: set.completed_at,
        exerciseId: sessionExercise.exercise_id,
        reps: set.reps,
        sessionDate: session.session_date,
        sessionId: session.id,
        sessionStartedAt: session.started_at,
        setId: set.id,
        weightKg: set.weight_kg,
      },
    ];
  });
  const exerciseIds = [...new Set(sets.map((set) => set.exerciseId))];
  const exerciseRows = await fetchExercises(exerciseIds);

  return {
    exercises: exerciseRows
      .map((exercise) => {
        const latestSessionAt = sets
          .filter((set) => set.exerciseId === exercise.id)
          .reduce(
            (latest, set) => (set.sessionStartedAt > latest ? set.sessionStartedAt : latest),
            '',
          );

        return {
          displayName: getExerciseDisplayName(exercise, locale),
          id: exercise.id,
          latestSessionAt,
        };
      })
      .sort((left, right) => right.latestSessionAt.localeCompare(left.latestSessionAt)),
    locale,
    sets,
  };
}
