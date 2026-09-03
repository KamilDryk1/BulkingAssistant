import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDailyWorkoutExerciseReadState,
  isDailyWorkoutExerciseSchemaMissing,
} from '../../src/features/training/daily-workout-exercise-state';

test('keeps Today available when the Stage 2 tables have not been deployed', () => {
  for (const table of [
    'daily_workout_exercise_overrides',
    'daily_workout_exercise_override_items',
  ]) {
    const error = {
      code: 'PGRST205',
      message: `Could not find the table 'public.${table}' in the schema cache`,
    };

    assert.equal(isDailyWorkoutExerciseSchemaMissing(error), true);
    assert.equal(
      getDailyWorkoutExerciseReadState({ error, isError: true, isPending: false }),
      'schema_missing',
    );
  }
});

test('recognizes PostgreSQL undefined-table responses for Stage 2 only', () => {
  assert.equal(
    isDailyWorkoutExerciseSchemaMissing({
      code: '42P01',
      message: 'relation "public.daily_workout_exercise_overrides" does not exist',
    }),
    true,
  );
  assert.equal(
    isDailyWorkoutExerciseSchemaMissing({
      code: 'PGRST205',
      message: "Could not find the table 'public.workout_plans' in the schema cache",
    }),
    false,
  );
});

test('does not hide authentication, permission, network, or unrelated schema errors', () => {
  for (const error of [
    { code: '42501', message: 'permission denied for table daily_workout_exercise_overrides' },
    { code: 'PGRST301', message: 'JWT expired' },
    { code: 'PGRST204', message: 'Missing column on daily_workout_exercise_overrides' },
    { code: 'PGRST205', message: "Could not find the table 'public.workout_plans'" },
    new TypeError('Network request failed'),
    null,
  ]) {
    assert.equal(isDailyWorkoutExerciseSchemaMissing(error), false);
    assert.equal(
      getDailyWorkoutExerciseReadState({ error, isError: true, isPending: false }),
      'error',
    );
  }
});

test('keeps normal and loading states distinct from a missing backend', () => {
  assert.equal(
    getDailyWorkoutExerciseReadState({ error: null, isError: false, isPending: true }),
    'loading',
  );
  assert.equal(
    getDailyWorkoutExerciseReadState({ error: null, isError: false, isPending: false }),
    'ready',
  );
});
