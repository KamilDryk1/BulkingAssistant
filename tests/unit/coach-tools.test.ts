import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coachToolDefinitions,
  getCoachToolKind,
  parseCoachToolArguments,
} from '../../src/features/ai/coach-tools';

const planId = '11111111-1111-4111-8111-111111111111';
const exerciseId = '22222222-2222-4222-8222-222222222222';

test('exposes only strict, bounded Coach tools', () => {
  assert.equal(coachToolDefinitions.length, 20);
  assert.equal(new Set(coachToolDefinitions.map((tool) => tool.name)).size, 20);
  coachToolDefinitions.forEach((tool) => {
    assert.equal(tool.type, 'function');
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters.additionalProperties, false);
  });
});

test('classifies read, today-only, and persistent tools', () => {
  assert.equal(getCoachToolKind('get_weight_trend'), 'read');
  assert.equal(getCoachToolKind('replace_exercise_for_today'), 'daily_write');
  assert.equal(getCoachToolKind('update_workout_plan'), 'persistent_write');
});

test('keeps array uniqueness in runtime validation instead of the provider schema', () => {
  assert.equal(JSON.stringify(coachToolDefinitions).includes('"uniqueItems"'), false);
  assert.throws(() =>
    parseCoachToolArguments(
      'create_workout_plan',
      JSON.stringify({ exerciseIds: [exerciseId, exerciseId], name: 'Upper' }),
    ),
  );
});

test('parses a strict today-only replacement by stable IDs', () => {
  assert.deepEqual(
    parseCoachToolArguments(
      'replace_exercise_for_today',
      JSON.stringify({
        exerciseToReplaceId: exerciseId,
        replacementExerciseId: '33333333-3333-4333-8333-333333333333',
        workoutPlanId: planId,
      }),
    ),
    {
      arguments: {
        exerciseToReplaceId: exerciseId,
        replacementExerciseId: '33333333-3333-4333-8333-333333333333',
        workoutPlanId: planId,
      },
      name: 'replace_exercise_for_today',
    },
  );
});

test('rejects unknown fields, malformed IDs, duplicates, and invalid calorie steps', () => {
  assert.throws(() =>
    parseCoachToolArguments('get_today_context', JSON.stringify({ userId: planId })),
  );
  assert.throws(() =>
    parseCoachToolArguments(
      'update_workout_plan',
      JSON.stringify({
        exerciseIds: [exerciseId, exerciseId],
        name: 'Upper',
        workoutPlanId: planId,
      }),
    ),
  );
  assert.throws(() =>
    parseCoachToolArguments(
      'replace_exercise_for_today',
      JSON.stringify({
        exerciseToReplaceId: 'Squat',
        replacementExerciseId: exerciseId,
        workoutPlanId: planId,
      }),
    ),
  );
  assert.throws(() =>
    parseCoachToolArguments(
      'update_nutrition_adjustment',
      JSON.stringify({ calorieAdjustment: 125 }),
    ),
  );
});
