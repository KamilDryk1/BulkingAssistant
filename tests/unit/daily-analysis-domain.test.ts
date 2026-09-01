import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDailyAnalysisContext,
  formatDateInTimeZone,
  shiftAnalysisDateKey,
  summarizeDailyAnalysisAdherence,
  summarizeDailyAnalysisStrength,
  summarizeDailyAnalysisWeights,
  type DailyAnalysisStrengthSetSource,
} from '../../src/features/ai/daily-analysis-domain';

const analysisDate = '2026-08-28';

test('resolves the current calendar date at opposite local-midnight boundaries', () => {
  const instant = new Date('2026-08-28T00:30:00.000Z');

  assert.equal(formatDateInTimeZone(instant, 'Europe/Warsaw'), '2026-08-28');
  assert.equal(formatDateInTimeZone(instant, 'America/Los_Angeles'), '2026-08-27');
});

test('summarizes rolling weight averages from the latest entry on each day', () => {
  const previous = Array.from({ length: 7 }, (_, index) => {
    const date = shiftAnalysisDateKey(analysisDate, -13 + index);
    return { date, recordedAt: `${date}T08:00:00.000Z`, weightKg: 70 };
  });
  const current = Array.from({ length: 7 }, (_, index) => {
    const date = shiftAnalysisDateKey(analysisDate, -6 + index);
    return { date, recordedAt: `${date}T08:00:00.000Z`, weightKg: 71 };
  });
  const duplicate = {
    date: analysisDate,
    recordedAt: `${analysisDate}T18:00:00.000Z`,
    weightKg: 72,
  };
  const summary = summarizeDailyAnalysisWeights(
    [...previous, ...current, duplicate],
    analysisDate,
    'kg',
    'en',
  );

  assert.equal(summary.measurementCount, 14);
  assert.equal(summary.latest?.kg, 72);
  assert.equal(summary.previous7DayAverage?.kg, 70);
  assert.equal(summary.current7DayAverage?.kg, 71.14);
  assert.equal(summary.change14Days?.kg, 1.14);
});

test('requires repeated comparable sessions before reporting a strength trend', () => {
  const makeSet = (
    sessionId: string,
    date: string,
    weightKg: number,
  ): DailyAnalysisStrengthSetSource => ({
    completedAt: `${date}T11:00:00.000Z`,
    exerciseKey: 'bench-press',
    exerciseName: 'Bench press',
    reps: 10,
    sessionDate: date,
    sessionId,
    sessionStartedAt: `${date}T10:00:00.000Z`,
    weightKg,
  });
  const dates = ['2026-08-01', '2026-08-15', '2026-08-28'];
  const workouts = dates.map((date, index) => ({
    date,
    id: `session-${index}`,
    workoutPlanId: 'plan-1',
  }));
  const summary = summarizeDailyAnalysisStrength(
    dates.map((date, index) => makeSet(`session-${index}`, date, 60 + index * 3)),
    workouts,
    analysisDate,
    'kg',
    'en',
  );

  assert.equal(summary.comparableExerciseCount, 1);
  assert.equal(summary.exercises[0].direction, 'improving');
  assert.equal(summary.exercises[0].percentChange, 10);
  assert.equal(summary.exercises[0].sessionCount, 3);
});

test('matches planned and completed workouts by local date and plan', () => {
  const summary = summarizeDailyAnalysisAdherence(
    [
      { date: '2026-08-20', workoutPlanId: 'plan-a' },
      { date: '2026-08-22', workoutPlanId: 'plan-b' },
      { date: analysisDate, workoutPlanId: 'plan-a' },
    ],
    [
      { date: '2026-08-20', id: 'session-a', workoutPlanId: 'plan-a' },
      { date: '2026-08-22', id: 'session-b', workoutPlanId: 'another-plan' },
    ],
    analysisDate,
  );

  assert.deepEqual(summary, {
    completedSessions: 1,
    completionRate: 0.5,
    plannedSessions: 2,
    skippedSessions: 1,
  });
});

test('marks sparse context insufficient without asking the model to guess', () => {
  const context = buildDailyAnalysisContext({
    activities: [],
    analysisDate,
    completedWorkouts: [],
    displayWeightUnit: 'kg',
    goal: 'gain',
    goalChangedDate: null,
    locale: 'en',
    nutrition: {
      baseCalories: 2800,
      calorieAdjustment: 0,
      effectiveCalories: 2800,
      macros: { carbohydrateGrams: 350, fatGrams: 80, proteinGrams: 160 },
    },
    plannedWorkouts: [],
    strengthSets: [],
    trainingChangedDate: null,
    weights: [],
  });

  assert.equal(context.sufficiency.canAnalyze, false);
  assert.ok(context.sufficiency.reasons.includes('insufficient_weight_history'));
  assert.ok(context.sufficiency.reasons.includes('insufficient_comparable_strength_history'));
});
