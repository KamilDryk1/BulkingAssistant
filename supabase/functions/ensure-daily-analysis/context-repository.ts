import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildDailyAnalysisContext,
  formatDateInTimeZone,
  shiftAnalysisDateKey,
  type DailyAnalysisActivitySource,
  type DailyAnalysisPlannedWorkoutSource,
  type DailyAnalysisStrengthSetSource,
  type DailyAnalysisWorkoutSource,
  type DailyAnalysisWeightSource,
} from '@/features/ai/daily-analysis-domain.ts';
import type { DailyAnalysisContext } from '@/features/ai/daily-analysis-types.ts';
import type { Database } from '@/types/database.ts';

type AppClient = SupabaseClient<Database>;

function assertNoError(error: { message: string } | null, code: string) {
  if (error) {
    throw new Error(`${code}:${error.message}`);
  }
}

function dateKeyFromTimestamp(value: string, timeZone: string) {
  return formatDateInTimeZone(new Date(value), timeZone);
}

function maxDateKey(values: readonly (string | null | undefined)[], timeZone: string) {
  const dates = values
    .filter((value): value is string => Boolean(value))
    .map((value) => dateKeyFromTimestamp(value, timeZone))
    .sort();

  return dates.at(-1) ?? null;
}

function getIsoWeekday(dateKey: string) {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function enumerateDateKeys(startDate: string, endDate: string) {
  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = shiftAnalysisDateKey(current, 1);
  }

  return dates;
}

export async function fetchDailyAnalysisContext(
  client: AppClient,
  userId: string,
  analysisDate: string,
  timeZone: string,
): Promise<DailyAnalysisContext> {
  const strengthStart = shiftAnalysisDateKey(analysisDate, -41);
  const contextStart = shiftAnalysisDateKey(analysisDate, -27);
  const activityStart = shiftAnalysisDateKey(analysisDate, -13);
  const weightTimestampStart = `${shiftAnalysisDateKey(contextStart, -1)}T00:00:00.000Z`;

  const [
    profileResult,
    weightResult,
    sessionResult,
    activityResult,
    nutritionResult,
    weeklyResult,
    overrideResult,
    planResult,
  ] = await Promise.all([
    client.from('profiles').select('*').eq('user_id', userId).single(),
    client
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', weightTimestampStart)
      .order('recorded_at'),
    client
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('session_date', strengthStart)
      .lte('session_date', analysisDate)
      .order('started_at'),
    client
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('activity_date', activityStart)
      .lte('activity_date', analysisDate)
      .order('activity_date'),
    client
      .from('nutrition_target_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('target_date', analysisDate)
      .maybeSingle(),
    client
      .from('weekly_schedule_items')
      .select('*')
      .eq('user_id', userId)
      .order('weekday')
      .order('position'),
    client
      .from('daily_schedule_overrides')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', contextStart)
      .lte('scheduled_date', analysisDate)
      .order('scheduled_date'),
    client.from('workout_plans').select('*').eq('user_id', userId),
  ]);

  [
    profileResult.error,
    weightResult.error,
    sessionResult.error,
    activityResult.error,
    nutritionResult.error,
    weeklyResult.error,
    overrideResult.error,
    planResult.error,
  ].forEach((error, index) => assertNoError(error, `CONTEXT_QUERY_${index + 1}_FAILED`));

  const profile = profileResult.data;
  if (!profile || !profile.goal || !profile.onboarding_completed_at) {
    throw new Error('PROFILE_NOT_READY');
  }

  const sessions = sessionResult.data ?? [];
  const sessionIds = sessions.map((session) => session.id);
  const overrides = overrideResult.data ?? [];
  const overrideIds = overrides.map((override) => override.id);
  const plans = planResult.data ?? [];
  const planIds = plans.map((plan) => plan.id);

  const [sessionExerciseResult, overrideItemResult, planExerciseResult] = await Promise.all([
    sessionIds.length
      ? client
          .from('workout_session_exercises')
          .select('*')
          .in('workout_session_id', sessionIds)
          .order('position')
      : Promise.resolve({ data: [], error: null }),
    overrideIds.length
      ? client
          .from('daily_schedule_override_items')
          .select('*')
          .in('daily_override_id', overrideIds)
          .order('position')
      : Promise.resolve({ data: [], error: null }),
    planIds.length
      ? client.from('workout_plan_exercises').select('*').in('workout_plan_id', planIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  assertNoError(sessionExerciseResult.error, 'SESSION_EXERCISES_QUERY_FAILED');
  assertNoError(overrideItemResult.error, 'OVERRIDE_ITEMS_QUERY_FAILED');
  assertNoError(planExerciseResult.error, 'PLAN_EXERCISES_QUERY_FAILED');

  const sessionExercises = sessionExerciseResult.data ?? [];
  const sessionExerciseIds = sessionExercises.map((exercise) => exercise.id);
  const setResult = sessionExerciseIds.length
    ? await client
        .from('workout_sets')
        .select('*')
        .in('session_exercise_id', sessionExerciseIds)
        .not('completed_at', 'is', null)
        .order('completed_at')
    : { data: [], error: null };
  assertNoError(setResult.error, 'WORKOUT_SETS_QUERY_FAILED');

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const exerciseById = new Map(sessionExercises.map((exercise) => [exercise.id, exercise]));
  const strengthSets = (setResult.data ?? []).flatMap((set): DailyAnalysisStrengthSetSource[] => {
    const exercise = exerciseById.get(set.session_exercise_id);
    const session = exercise ? sessionById.get(exercise.workout_session_id) : null;

    if (!exercise || !session) {
      return [];
    }

    return [
      {
        completedAt: set.completed_at,
        exerciseKey: exercise.exercise_id ?? exercise.exercise_name_snapshot,
        exerciseName: exercise.exercise_name_snapshot,
        reps: set.reps,
        sessionDate: session.session_date,
        sessionId: session.id,
        sessionStartedAt: session.started_at,
        weightKg: Number(set.weight_kg),
      },
    ];
  });
  const completedWorkouts: DailyAnalysisWorkoutSource[] = sessions.map((session) => ({
    date: session.session_date,
    id: session.id,
    workoutPlanId: session.workout_plan_id,
  }));
  const weights: DailyAnalysisWeightSource[] = (weightResult.data ?? []).map((weight) => ({
    date: dateKeyFromTimestamp(weight.recorded_at, timeZone),
    recordedAt: weight.recorded_at,
    weightKg: Number(weight.weight_kg),
  }));
  const activities: DailyAnalysisActivitySource[] = (activityResult.data ?? []).map((activity) => ({
    date: activity.activity_date,
    durationMinutes: activity.duration_minutes,
    intensity: activity.intensity,
    name: activity.activity_name_snapshot,
  }));

  const overrideItems = overrideItemResult.data ?? [];
  const overrideByDate = new Map(
    overrides.map((override) => [
      override.scheduled_date,
      overrideItems.filter((item) => item.daily_override_id === override.id),
    ]),
  );
  const weeklyItems = weeklyResult.data ?? [];
  const plannedWorkouts: DailyAnalysisPlannedWorkoutSource[] = enumerateDateKeys(
    contextStart,
    analysisDate,
  ).flatMap((date) => {
    const scheduledItems = overrideByDate.has(date)
      ? (overrideByDate.get(date) ?? [])
      : weeklyItems.filter((item) => item.weekday === getIsoWeekday(date));

    return scheduledItems.flatMap((item) =>
      item.item_type === 'workout' && item.workout_plan_id
        ? [{ date, workoutPlanId: item.workout_plan_id }]
        : [],
    );
  });
  const nutrition = nutritionResult.data
    ? {
        baseCalories: nutritionResult.data.base_calories,
        calorieAdjustment: nutritionResult.data.calorie_adjustment_calories,
        effectiveCalories: nutritionResult.data.calories,
        macros: {
          carbohydrateGrams: nutritionResult.data.carbohydrate_grams,
          fatGrams: nutritionResult.data.fat_grams,
          proteinGrams: nutritionResult.data.protein_grams,
        },
      }
    : null;
  const trainingChangedDate = maxDateKey(
    [
      ...weeklyItems.map((item) => item.updated_at),
      ...overrides.map((override) => override.updated_at),
      ...overrideItems.map((item) => item.updated_at),
      ...plans.map((plan) => plan.updated_at),
      ...(planExerciseResult.data ?? []).map((exercise) => exercise.updated_at),
    ],
    timeZone,
  );

  return buildDailyAnalysisContext({
    activities,
    analysisDate,
    completedWorkouts,
    displayWeightUnit: profile.preferred_weight_unit,
    goal: profile.goal,
    goalChangedDate: profile.goal_changed_at
      ? dateKeyFromTimestamp(profile.goal_changed_at, timeZone)
      : null,
    locale: profile.locale,
    nutrition,
    plannedWorkouts,
    strengthSets,
    trainingChangedDate,
    weights,
  });
}
