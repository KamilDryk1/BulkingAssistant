const dailyWorkoutExerciseTables = [
  'daily_workout_exercise_overrides',
  'daily_workout_exercise_override_items',
] as const;

export function isDailyWorkoutExerciseSchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code, message } = error as { code?: unknown; message?: unknown };
  return (
    (code === 'PGRST205' || code === '42P01') &&
    typeof message === 'string' &&
    dailyWorkoutExerciseTables.some((table) => message.includes(table))
  );
}

export function getDailyWorkoutExerciseReadState(query: {
  error: unknown;
  isError: boolean;
  isPending: boolean;
}): 'loading' | 'ready' | 'schema_missing' | 'error' {
  if (query.isError) {
    return isDailyWorkoutExerciseSchemaMissing(query.error) ? 'schema_missing' : 'error';
  }

  return query.isPending ? 'loading' : 'ready';
}
