import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateAge, calculateNutritionTarget } from '../../src/features/today/nutrition-domain';
import { calculateSevenDayAverage } from '../../src/features/today/today-domain';
import type { WeightLogRow } from '../../src/types/database';

function createWeightLog(id: string, recordedAt: string, weightKg: number): WeightLogRow {
  return {
    created_at: recordedAt,
    id,
    recorded_at: recordedAt,
    updated_at: recordedAt,
    user_id: 'test-user',
    weight_kg: weightKg,
  };
}

test('calculates age against the target date instead of the current clock', () => {
  assert.equal(calculateAge('1996-08-30', '2026-08-29'), 29);
  assert.equal(calculateAge('1996-08-30', '2026-08-30'), 30);
});

test('calculates a deterministic Mifflin-St Jeor maintenance target', () => {
  assert.deepEqual(
    calculateNutritionTarget({
      activityLevel: 'moderate',
      dateOfBirth: '1996-08-29',
      goal: 'maintain',
      heightCm: 180,
      sex: 'male',
      targetDate: '2026-08-29',
      weightKg: 80,
    }),
    {
      baselineCalories: 2759,
      calories: 2760,
      carbohydrateGrams: 373,
      fatGrams: 77,
      goalAdjustmentCalories: 0,
      maintenanceCalories: 2759,
      plannedTrainingCalories: 0,
      proteinGrams: 144,
      restingCalories: 1780,
      weeklyPlannedTrainingCalories: 0,
    },
  );
});

test('adds the average net cost of the weekly training plan once', () => {
  const target = calculateNutritionTarget({
    activityLevel: 'light',
    dateOfBirth: '1996-08-29',
    goal: 'maintain',
    heightCm: 180,
    plannedSessions: Array.from({ length: 4 }, () => ({ durationMinutes: 60, met: 5 })),
    sex: 'male',
    targetDate: '2026-08-29',
    weightKg: 80,
  });

  assert.equal(target.baselineCalories, 2448);
  assert.equal(target.weeklyPlannedTrainingCalories, 1383);
  assert.equal(target.plannedTrainingCalories, 198);
  assert.equal(target.maintenanceCalories, 2645);
  assert.equal(target.calories, 2650);
});

test('applies goal-specific calories and protein without changing input values', () => {
  const input = {
    activityLevel: 'moderate' as const,
    dateOfBirth: '1996-08-29',
    goal: 'cut' as const,
    heightCm: 180,
    sex: 'male' as const,
    targetDate: '2026-08-29',
    weightKg: 80,
  };

  const target = calculateNutritionTarget(input);

  assert.equal(target.calories, 2360);
  assert.equal(target.proteinGrams, 160);
  assert.equal(input.weightKg, 80);
});

test('keeps extreme inputs above the configured calorie safeguard', () => {
  const target = calculateNutritionTarget({
    activityLevel: 'sedentary',
    dateOfBirth: '1926-08-29',
    goal: 'cut',
    heightCm: 140,
    sex: 'female',
    targetDate: '2026-08-29',
    weightKg: 40,
  });

  assert.equal(target.calories, 1200);
});

test('uses only the latest weight from each calendar day in the seven-day average', () => {
  const average = calculateSevenDayAverage([
    createWeightLog('1', '2026-08-28T08:00:00.000Z', 70),
    createWeightLog('2', '2026-08-28T10:00:00.000Z', 71),
    createWeightLog('3', '2026-08-29T08:00:00.000Z', 73),
  ]);

  assert.equal(average, 72);
  assert.equal(calculateSevenDayAverage([]), null);
});
