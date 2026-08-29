import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatElapsedTime,
  formatWorkoutWeight,
  getCalendarDayDifference,
  getInitialExerciseIndex,
  getLocalWorkoutDateKey,
  parseWorkoutSetInput,
} from '../../src/features/workout/workout-domain';
import type { WorkoutSetRow } from '../../src/types/database';

function createSet(completed: boolean): WorkoutSetRow {
  return {
    completed_at: completed ? '2026-08-29T10:00:00.000Z' : null,
    created_at: '2026-08-29T10:00:00.000Z',
    id: crypto.randomUUID(),
    reps: 8,
    session_exercise_id: crypto.randomUUID(),
    set_number: 1,
    updated_at: '2026-08-29T10:00:00.000Z',
    weight_kg: 60,
  };
}

test('formats elapsed workout time with and without hours', () => {
  assert.equal(formatElapsedTime(45 * 60 + 27), '45:27');
  assert.equal(formatElapsedTime(60 * 60 + 2 * 60 + 3), '1:02:03');
});

test('selects the first exercise that still needs work', () => {
  assert.equal(
    getInitialExerciseIndex([
      { sets: [createSet(true)] },
      { sets: [createSet(false)] },
      { sets: [] },
    ]),
    1,
  );
  assert.equal(
    getInitialExerciseIndex([{ sets: [createSet(true)] }, { sets: [createSet(true)] }]),
    1,
  );
});

test('calculates calendar-day distance without daylight-saving drift', () => {
  assert.equal(getCalendarDayDifference('2026-03-30', '2026-03-28'), 2);
});

test('creates a session date from the device local calendar', () => {
  assert.equal(getLocalWorkoutDateKey(new Date(2026, 7, 29, 23, 59)), '2026-08-29');
});

test('parses set input and converts pounds at the input boundary', () => {
  const parsed = parseWorkoutSetInput('132,28', '8', 'lb');

  assert.equal(parsed.error, null);
  assert.ok(parsed.value);
  assert.ok(Math.abs(parsed.value.weightKg - 60) < 0.01);
  assert.equal(parsed.value.reps, 8);
});

test('rejects invalid set inputs', () => {
  assert.equal(parseWorkoutSetInput('-1', '8', 'kg').error, 'weight');
  assert.equal(parseWorkoutSetInput('60', '0', 'kg').error, 'reps');
  assert.equal(parseWorkoutSetInput('60', '7.5', 'kg').error, 'reps');
});

test('formats canonical kilograms in the preferred unit', () => {
  assert.equal(formatWorkoutWeight(62.5, 'kg'), '62.5');
  assert.equal(formatWorkoutWeight(60, 'lb'), '132.28');
});
