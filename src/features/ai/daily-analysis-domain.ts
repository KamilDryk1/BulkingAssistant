import { calculateEstimatedOneRepMax } from '../progress/progress-domain.ts';
import { formatLocalizedWeight, formatLocalizedWeightChange } from '../units/weight.ts';
import type {
  DailyAnalysisActivitySummary,
  DailyAnalysisAdherenceSummary,
  DailyAnalysisContext,
  DailyAnalysisExerciseSummary,
  DailyAnalysisNutritionSummary,
  DailyAnalysisStrengthSummary,
  DailyAnalysisWeightSummary,
  WeightMetric,
  WeightPeriodAverage,
} from './daily-analysis-types.ts';

export const dailyAnalysisContextVersion = 'daily-analysis-context-v1' as const;

export type DailyAnalysisWeightSource = {
  date: string;
  recordedAt: string;
  weightKg: number;
};

export type DailyAnalysisStrengthSetSource = {
  completedAt: string | null;
  exerciseKey: string;
  exerciseName: string;
  reps: number;
  sessionDate: string;
  sessionId: string;
  sessionStartedAt: string;
  weightKg: number;
};

export type DailyAnalysisWorkoutSource = {
  date: string;
  id: string;
  workoutPlanId: string | null;
};

export type DailyAnalysisPlannedWorkoutSource = {
  date: string;
  workoutPlanId: string;
};

export type DailyAnalysisActivitySource = {
  date: string;
  durationMinutes: number | null;
  intensity: string | null;
  name: string;
};

export type BuildDailyAnalysisContextInput = {
  activities: readonly DailyAnalysisActivitySource[];
  analysisDate: string;
  completedWorkouts: readonly DailyAnalysisWorkoutSource[];
  displayWeightUnit: 'kg' | 'lb';
  goal: 'cut' | 'maintain' | 'gain';
  goalChangedDate: string | null;
  locale: 'en' | 'pl';
  nutrition: DailyAnalysisNutritionSummary | null;
  plannedWorkouts: readonly DailyAnalysisPlannedWorkoutSource[];
  strengthSets: readonly DailyAnalysisStrengthSetSource[];
  trainingChangedDate: string | null;
  weights: readonly DailyAnalysisWeightSource[];
};

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function shiftAnalysisDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  if (!values.year || !values.month || !values.day) {
    throw new Error('TIME_ZONE_DATE_FORMAT_FAILED');
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export function isCurrentDateInTimeZone(analysisDate: string, timeZone: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(analysisDate)) {
    return false;
  }

  try {
    return formatDateInTimeZone(now, timeZone) === analysisDate;
  } catch {
    return false;
  }
}

function round(value: number, fractionDigits = 2) {
  const scale = 10 ** fractionDigits;
  return Math.round(value * scale) / scale;
}

function average(values: readonly number[]) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function makeWeightMetric(
  valueKg: number,
  unit: 'kg' | 'lb',
  locale: 'en' | 'pl',
  signed = false,
): WeightMetric {
  const value = round(valueKg);
  return {
    display: `${
      signed
        ? formatLocalizedWeightChange(value, unit, locale, 2)
        : formatLocalizedWeight(value, unit, locale, 2)
    } ${unit}`,
    kg: value,
  };
}

function latestWeightsPerDay(weights: readonly DailyAnalysisWeightSource[]) {
  const latest = new Map<string, DailyAnalysisWeightSource>();

  weights.forEach((weight) => {
    const existing = latest.get(weight.date);
    if (!existing || weight.recordedAt > existing.recordedAt) {
      latest.set(weight.date, weight);
    }
  });

  return [...latest.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function summarizeAverage(
  weights: readonly DailyAnalysisWeightSource[],
  startDate: string,
  endDate: string,
  unit: 'kg' | 'lb',
  locale: 'en' | 'pl',
): WeightPeriodAverage | null {
  const values = weights
    .filter((weight) => weight.date >= startDate && weight.date <= endDate)
    .map((weight) => weight.weightKg);
  const value = average(values);

  return value === null
    ? null
    : { ...makeWeightMetric(value, unit, locale), measurementCount: values.length };
}

export function summarizeDailyAnalysisWeights(
  source: readonly DailyAnalysisWeightSource[],
  analysisDate: string,
  unit: 'kg' | 'lb',
  locale: 'en' | 'pl',
): DailyAnalysisWeightSummary {
  const periodStart = shiftAnalysisDateKey(analysisDate, -27);
  const weights = latestWeightsPerDay(source).filter(
    (weight) => weight.date >= periodStart && weight.date <= analysisDate,
  );
  const current = summarizeAverage(
    weights,
    shiftAnalysisDateKey(analysisDate, -6),
    analysisDate,
    unit,
    locale,
  );
  const previous = summarizeAverage(
    weights,
    shiftAnalysisDateKey(analysisDate, -13),
    shiftAnalysisDateKey(analysisDate, -7),
    unit,
    locale,
  );
  const earliest = summarizeAverage(
    weights,
    shiftAnalysisDateKey(analysisDate, -27),
    shiftAnalysisDateKey(analysisDate, -21),
    unit,
    locale,
  );
  const latest = weights.at(-1) ?? null;
  const change14 = current && previous ? current.kg - previous.kg : null;
  const change28 = current && earliest ? current.kg - earliest.kg : null;

  return {
    change14Days: change14 === null ? null : makeWeightMetric(change14, unit, locale, true),
    change28Days: change28 === null ? null : makeWeightMetric(change28, unit, locale, true),
    current7DayAverage: current,
    latest: latest
      ? { ...makeWeightMetric(latest.weightKg, unit, locale), date: latest.date }
      : null,
    measurementCount: weights.length,
    previous7DayAverage: previous,
    weeklyRate:
      change28 !== null
        ? makeWeightMetric(change28 / 3, unit, locale, true)
        : change14 !== null
          ? makeWeightMetric(change14, unit, locale, true)
          : null,
  };
}

type SessionStrengthPoint = {
  bestSet: { reps: number; weightKg: number };
  date: string;
  estimatedOneRepMaxKg: number;
  occurredAt: string;
};

function buildExercisePoints(sets: readonly DailyAnalysisStrengthSetSource[]) {
  const sessions = new Map<string, DailyAnalysisStrengthSetSource[]>();

  sets.forEach((set) => {
    if (set.completedAt && set.reps > 0 && set.weightKg >= 0) {
      const current = sessions.get(set.sessionId) ?? [];
      current.push(set);
      sessions.set(set.sessionId, current);
    }
  });

  return [...sessions.values()]
    .map((sessionSets): SessionStrengthPoint => {
      const strongest = sessionSets.reduce((best, set) => {
        const estimate = calculateEstimatedOneRepMax(set.weightKg, set.reps);
        return estimate > calculateEstimatedOneRepMax(best.weightKg, best.reps) ? set : best;
      });
      const bestSet = sessionSets.reduce((best, set) => {
        if (set.weightKg !== best.weightKg) {
          return set.weightKg > best.weightKg ? set : best;
        }
        return set.reps > best.reps ? set : best;
      });

      return {
        bestSet: { reps: bestSet.reps, weightKg: bestSet.weightKg },
        date: strongest.sessionDate,
        estimatedOneRepMaxKg: calculateEstimatedOneRepMax(strongest.weightKg, strongest.reps),
        occurredAt: strongest.sessionStartedAt,
      };
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

export function summarizeDailyAnalysisStrength(
  sets: readonly DailyAnalysisStrengthSetSource[],
  completedWorkouts: readonly DailyAnalysisWorkoutSource[],
  analysisDate: string,
  unit: 'kg' | 'lb',
  locale: 'en' | 'pl',
): DailyAnalysisStrengthSummary {
  const setsByExercise = new Map<string, DailyAnalysisStrengthSetSource[]>();

  sets.forEach((set) => {
    const current = setsByExercise.get(set.exerciseKey) ?? [];
    current.push(set);
    setsByExercise.set(set.exerciseKey, current);
  });

  const exercises = [...setsByExercise.values()].flatMap((exerciseSets) => {
    const points = buildExercisePoints(exerciseSets);
    if (points.length < 2) {
      return [];
    }

    const first = points[0];
    const recent = points.at(-1)!;
    const percentChange =
      first.estimatedOneRepMaxKg === 0
        ? 0
        : ((recent.estimatedOneRepMaxKg - first.estimatedOneRepMaxKg) /
            first.estimatedOneRepMaxKg) *
          100;
    const direction =
      percentChange > 1.5 ? 'improving' : percentChange < -1.5 ? 'declining' : 'flat';

    return [
      {
        bestSetEarlier: {
          reps: first.bestSet.reps,
          weight: makeWeightMetric(first.bestSet.weightKg, unit, locale),
        },
        bestSetRecent: {
          reps: recent.bestSet.reps,
          weight: makeWeightMetric(recent.bestSet.weightKg, unit, locale),
        },
        direction,
        earlierEstimatedOneRepMax: makeWeightMetric(first.estimatedOneRepMaxKg, unit, locale),
        firstSessionDate: first.date,
        lastSessionDate: recent.date,
        name: exerciseSets[0].exerciseName,
        percentChange: round(percentChange, 1),
        recentEstimatedOneRepMax: makeWeightMetric(recent.estimatedOneRepMaxKg, unit, locale),
        sessionCount: points.length,
      } satisfies DailyAnalysisExerciseSummary,
    ];
  });
  const recentStart = shiftAnalysisDateKey(analysisDate, -20);
  const previousStart = shiftAnalysisDateKey(analysisDate, -41);
  const previousEnd = shiftAnalysisDateKey(analysisDate, -21);

  return {
    comparableExerciseCount: exercises.filter(
      (exercise) =>
        exercise.sessionCount >= 3 &&
        exercise.firstSessionDate <= shiftAnalysisDateKey(exercise.lastSessionDate, -14),
    ).length,
    completedSessionCount: completedWorkouts.length,
    exercises: exercises.sort((left, right) => right.sessionCount - left.sessionCount).slice(0, 8),
    previousWeeklyFrequency: round(
      completedWorkouts.filter(
        (workout) => workout.date >= previousStart && workout.date <= previousEnd,
      ).length / 3,
      1,
    ),
    recentWeeklyFrequency: round(
      completedWorkouts.filter(
        (workout) => workout.date >= recentStart && workout.date <= analysisDate,
      ).length / 3,
      1,
    ),
  };
}

export function summarizeDailyAnalysisAdherence(
  plannedWorkouts: readonly DailyAnalysisPlannedWorkoutSource[],
  completedWorkouts: readonly DailyAnalysisWorkoutSource[],
  analysisDate: string,
): DailyAnalysisAdherenceSummary {
  const eligiblePlanned = plannedWorkouts.filter((workout) => workout.date < analysisDate);
  const completedKeys = new Set(
    completedWorkouts.flatMap((workout) =>
      workout.workoutPlanId ? [`${workout.date}|${workout.workoutPlanId}`] : [],
    ),
  );
  const completedSessions = eligiblePlanned.filter((workout) =>
    completedKeys.has(`${workout.date}|${workout.workoutPlanId}`),
  ).length;

  return {
    completedSessions,
    completionRate:
      eligiblePlanned.length === 0 ? null : round(completedSessions / eligiblePlanned.length, 2),
    plannedSessions: eligiblePlanned.length,
    skippedSessions: eligiblePlanned.length - completedSessions,
  };
}

export function summarizeDailyAnalysisActivities(
  source: readonly DailyAnalysisActivitySource[],
  analysisDate: string,
): DailyAnalysisActivitySummary {
  const currentStart = shiftAnalysisDateKey(analysisDate, -6);
  const previousStart = shiftAnalysisDateKey(analysisDate, -13);
  const previousEnd = shiftAnalysisDateKey(analysisDate, -7);
  const current = source.filter(
    (activity) => activity.date >= currentStart && activity.date <= analysisDate,
  );
  const previous = source.filter(
    (activity) => activity.date >= previousStart && activity.date <= previousEnd,
  );
  const totalDuration = (items: readonly DailyAnalysisActivitySource[]) =>
    items.reduce((total, item) => total + (item.durationMinutes ?? 0), 0);
  const recentByName = new Map<string, DailyAnalysisActivitySource[]>();
  source.forEach((activity) => {
    const items = recentByName.get(activity.name) ?? [];
    items.push(activity);
    recentByName.set(activity.name, items);
  });
  const currentDuration = totalDuration(current);
  const previousDuration = totalDuration(previous);

  return {
    current7DayDurationMinutes: currentDuration,
    durationChangeMinutes: currentDuration - previousDuration,
    previous7DayDurationMinutes: previousDuration,
    recent: [...recentByName.entries()]
      .map(([name, items]) => ({
        durationMinutes: totalDuration(items),
        intensity: items.at(-1)?.intensity ?? null,
        logCount: items.length,
        name,
      }))
      .sort((left, right) => right.durationMinutes - left.durationMinutes)
      .slice(0, 8),
  };
}

function changedRecently(changedDate: string | null, analysisDate: string, days: number) {
  return Boolean(
    changedDate &&
    changedDate <= analysisDate &&
    changedDate >= shiftAnalysisDateKey(analysisDate, -(days - 1)),
  );
}

export function buildDailyAnalysisContext(
  input: BuildDailyAnalysisContextInput,
): DailyAnalysisContext {
  const weight = summarizeDailyAnalysisWeights(
    input.weights,
    input.analysisDate,
    input.displayWeightUnit,
    input.locale,
  );
  const strength = summarizeDailyAnalysisStrength(
    input.strengthSets,
    input.completedWorkouts,
    input.analysisDate,
    input.displayWeightUnit,
    input.locale,
  );
  const adherence = summarizeDailyAnalysisAdherence(
    input.plannedWorkouts,
    input.completedWorkouts,
    input.analysisDate,
  );
  const activities = summarizeDailyAnalysisActivities(input.activities, input.analysisDate);
  const goalChangedRecently = changedRecently(input.goalChangedDate, input.analysisDate, 7);
  const trainingPlanChangedRecently = changedRecently(
    input.trainingChangedDate,
    input.analysisDate,
    14,
  );
  const weightTrendReady = Boolean(
    weight.current7DayAverage &&
    weight.current7DayAverage.measurementCount >= 3 &&
    weight.previous7DayAverage &&
    weight.previous7DayAverage.measurementCount >= 3,
  );
  const strengthTrendReady = strength.comparableExerciseCount > 0 && !trainingPlanChangedRecently;
  const adherenceReady = adherence.plannedSessions >= 2 && !trainingPlanChangedRecently;
  const activityTrendReady =
    activities.current7DayDurationMinutes > 0 && activities.previous7DayDurationMinutes > 0;
  const reasons = [
    !weightTrendReady ? 'insufficient_weight_history' : null,
    !strengthTrendReady ? 'insufficient_comparable_strength_history' : null,
    !adherenceReady ? 'insufficient_schedule_history' : null,
    !activityTrendReady ? 'insufficient_activity_history' : null,
    !input.nutrition ? 'missing_nutrition_target' : null,
    goalChangedRecently ? 'goal_changed_recently' : null,
    trainingPlanChangedRecently ? 'training_plan_changed_recently' : null,
  ].filter((reason): reason is string => Boolean(reason));
  const canAnalyze = Boolean(
    input.nutrition &&
    !goalChangedRecently &&
    (weightTrendReady || strengthTrendReady || adherenceReady || activityTrendReady),
  );

  return {
    activities,
    adherence,
    analysisDate: input.analysisDate,
    displayWeightUnit: input.displayWeightUnit,
    goal: input.goal,
    goalChangedRecently,
    locale: input.locale,
    nutrition: input.nutrition,
    strength,
    sufficiency: {
      activityTrendReady,
      adherenceReady,
      canAnalyze,
      reasons,
      strengthTrendReady,
      weightTrendReady,
    },
    trainingPlanChangedRecently,
    version: dailyAnalysisContextVersion,
    weight,
  };
}

export function applyCalorieAdjustment(baseCalories: number, calorieAdjustment: number) {
  return baseCalories + calorieAdjustment;
}
