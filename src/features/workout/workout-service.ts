import { getSupabaseClient } from '@/services/supabase/get-client';
import type { WorkoutSessionExerciseRow, WorkoutSetRow } from '@/types/database';

import type {
  SaveWorkoutSetInput,
  WorkoutHistoryPage,
  WorkoutSessionDetails,
} from './workout-types';
import { getLocalWorkoutDateKey } from './workout-domain';

export const workoutHistoryPageSize = 20;

export async function fetchActiveWorkoutSession(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function startWorkoutSession(planId: string) {
  const { data, error } = await getSupabaseClient().rpc('start_workout_session', {
    session_date_value: getLocalWorkoutDateKey(),
    workout_plan_id_value: planId,
  });

  if (error) {
    throw error;
  }

  return data;
}

async function fetchSessionExercises(sessionId: string) {
  const { data, error } = await getSupabaseClient()
    .from('workout_session_exercises')
    .select('*')
    .eq('workout_session_id', sessionId)
    .order('position');

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchSetsForExercises(exerciseIds: string[]) {
  if (exerciseIds.length === 0) {
    return [];
  }

  const { data, error } = await getSupabaseClient()
    .from('workout_sets')
    .select('*')
    .in('session_exercise_id', exerciseIds)
    .order('set_number');

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchPreviousPerformance(
  exercises: WorkoutSessionExerciseRow[],
  beforeStartedAt: string,
) {
  const exerciseIds = exercises.flatMap((exercise) =>
    exercise.exercise_id ? [exercise.exercise_id] : [],
  );

  if (exerciseIds.length === 0) {
    return [];
  }

  const { data, error } = await getSupabaseClient().rpc('get_previous_exercise_performance', {
    before_started_at_value: beforeStartedAt,
    exercise_ids: exerciseIds,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchWorkoutSessionDetails(
  userId: string,
  sessionId: string,
): Promise<WorkoutSessionDetails> {
  const client = getSupabaseClient();
  const { data: session, error: sessionError } = await client
    .from('workout_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (sessionError) {
    throw sessionError;
  }

  const exercises = await fetchSessionExercises(sessionId);
  const exerciseIds = exercises.map((exercise) => exercise.id);
  const [sets, previousPerformance] = await Promise.all([
    fetchSetsForExercises(exerciseIds),
    session.completed_at
      ? Promise.resolve([])
      : fetchPreviousPerformance(exercises, session.started_at),
  ]);

  return {
    exercises: exercises.map((exercise) => {
      const previousSets = exercise.exercise_id
        ? previousPerformance.filter((item) => item.exercise_id === exercise.exercise_id)
        : [];

      return {
        ...exercise,
        previousPerformance:
          previousSets.length > 0
            ? {
                date: previousSets[0].previous_session_date,
                sets: previousSets,
              }
            : null,
        sets: sets
          .filter((set) => set.session_exercise_id === exercise.id)
          .sort((left, right) => left.set_number - right.set_number),
      };
    }),
    session,
  };
}

export async function saveWorkoutSet(input: SaveWorkoutSetInput) {
  const { data, error } = await getSupabaseClient().rpc('save_workout_set', {
    completed_value: input.completed,
    reps_value: input.reps,
    session_exercise_id_value: input.sessionExerciseId,
    weight_kg_value: input.weightKg,
    workout_set_id_value: input.workoutSetId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteWorkoutSet(setId: string) {
  const { error } = await getSupabaseClient().rpc('delete_workout_set', {
    workout_set_id_value: setId,
  });

  if (error) {
    throw error;
  }
}

export async function finishWorkoutSession(sessionId: string) {
  const { data, error } = await getSupabaseClient().rpc('finish_workout_session', {
    workout_session_id_value: sessionId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteWorkoutSession(sessionId: string) {
  const { error } = await getSupabaseClient()
    .from('workout_sessions')
    .delete()
    .eq('id', sessionId)
    .not('completed_at', 'is', null);

  if (error) {
    throw error;
  }
}

export async function fetchWorkoutHistory(
  userId: string,
  page: number,
): Promise<WorkoutHistoryPage> {
  const start = page * workoutHistoryPageSize;
  const end = start + workoutHistoryPageSize;
  const { data: fetchedSessions, error: sessionError } = await getSupabaseClient()
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .range(start, end);

  if (sessionError) {
    throw sessionError;
  }

  const hasMore = (fetchedSessions?.length ?? 0) > workoutHistoryPageSize;
  const sessions = (fetchedSessions ?? []).slice(0, workoutHistoryPageSize);
  const sessionIds = sessions.map((session) => session.id);
  let exercises: WorkoutSessionExerciseRow[] = [];
  let sets: WorkoutSetRow[] = [];

  if (sessionIds.length > 0) {
    const { data, error } = await getSupabaseClient()
      .from('workout_session_exercises')
      .select('*')
      .in('workout_session_id', sessionIds)
      .order('position');

    if (error) {
      throw error;
    }

    exercises = data ?? [];
    sets = await fetchSetsForExercises(exercises.map((exercise) => exercise.id));
  }

  return {
    items: sessions.map((session) => {
      const sessionExercises = exercises.filter(
        (exercise) => exercise.workout_session_id === session.id,
      );
      const exerciseIds = new Set(sessionExercises.map((exercise) => exercise.id));

      return {
        ...session,
        completedSetCount: sets.filter(
          (set) => exerciseIds.has(set.session_exercise_id) && set.completed_at,
        ).length,
        exerciseCount: sessionExercises.length,
        exerciseNames: sessionExercises.map((exercise) => exercise.exercise_name_snapshot),
      };
    }),
    nextPage: hasMore ? page + 1 : null,
  };
}
