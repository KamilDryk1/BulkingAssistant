import {
  calculateNutritionTarget,
  nutritionCalculationVersion,
  strengthTrainingMetByIntensity,
  type PlannedTrainingSession,
} from '@/features/today/nutrition-domain';
import {
  calculateSevenDayAverage,
  getLocalDayBounds,
  getSevenDayStartIso,
} from '@/features/today/today-domain';
import { getIsoWeekDateKeys, resolveScheduleForWeek } from '@/features/training/training-domain';
import { getSupabaseClient } from '@/services/supabase/get-client';
import type {
  ActivityDefinitionRow,
  ActivityIntensity,
  DailyScheduleOverrideItemRow,
  NutritionTargetSnapshotRow,
  ProfileRow,
  WeightLogRow,
} from '@/types/database';

import type { SaveActivityLogInput, SaveTodayWeightInput, TodayData } from './today-types';

function targetMatches(
  snapshot: NutritionTargetSnapshotRow | null,
  target: ReturnType<typeof calculateNutritionTarget>,
) {
  return Boolean(
    snapshot &&
    snapshot.calculation_version === nutritionCalculationVersion &&
    snapshot.base_calories === target.baseCalories &&
    snapshot.calorie_adjustment_calories === target.calorieAdjustmentCalories &&
    snapshot.calories === target.calories &&
    snapshot.protein_grams === target.proteinGrams &&
    snapshot.carbohydrate_grams === target.carbohydrateGrams &&
    snapshot.fat_grams === target.fatGrams &&
    snapshot.resting_calories === target.restingCalories &&
    snapshot.baseline_calories === target.baselineCalories &&
    snapshot.planned_training_calories === target.plannedTrainingCalories &&
    snapshot.goal_adjustment_calories === target.goalAdjustmentCalories,
  );
}

function getActivityMet(activity: ActivityDefinitionRow, intensity: ActivityIntensity) {
  if (intensity === 'light') {
    return activity.met_light;
  }

  if (intensity === 'hard') {
    return activity.met_hard;
  }

  return activity.met_moderate;
}

async function fetchPlannedTrainingSessions(
  userId: string,
  date: string,
): Promise<PlannedTrainingSession[]> {
  const client = getSupabaseClient();
  const weekDates = getIsoWeekDateKeys(new Date(`${date}T12:00:00`));
  const [weeklyResult, overrideResult, activityResult] = await Promise.all([
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
      .gte('scheduled_date', weekDates[0])
      .lte('scheduled_date', weekDates[6]),
    client.from('activity_definitions').select('*'),
  ]);
  const firstError = [weeklyResult.error, overrideResult.error, activityResult.error].find(Boolean);

  if (firstError) {
    throw firstError;
  }

  const overrides = overrideResult.data ?? [];
  const overrideIds = overrides.map((override) => override.id);
  let overrideItems: DailyScheduleOverrideItemRow[] = [];

  if (overrideIds.length > 0) {
    const overrideItemsResult = await client
      .from('daily_schedule_override_items')
      .select('*')
      .in('daily_override_id', overrideIds)
      .order('position');

    if (overrideItemsResult.error) {
      throw overrideItemsResult.error;
    }

    overrideItems = overrideItemsResult.data ?? [];
  }

  const weeklyItems = weeklyResult.data ?? [];
  const activityById = new Map(
    (activityResult.data ?? []).map((activity) => [activity.id, activity]),
  );
  const normalizedWeeklyItems = weeklyItems.map((item) => ({
    durationMinutes: item.planned_duration_minutes ?? (item.item_type === 'rest' ? null : 60),
    id: item.id,
    intensity: item.planned_intensity ?? (item.item_type === 'rest' ? null : 'moderate'),
    itemType: item.item_type,
    position: item.position,
    referenceId: item.workout_plan_id ?? item.activity_definition_id,
    weekday: item.weekday,
  }));
  const normalizedOverrides = overrides.map((override) => ({
    date: override.scheduled_date,
    id: override.id,
    items: overrideItems
      .filter((item) => item.daily_override_id === override.id)
      .map((item) => ({
        durationMinutes: item.planned_duration_minutes ?? (item.item_type === 'rest' ? null : 60),
        intensity: item.planned_intensity ?? (item.item_type === 'rest' ? null : 'moderate'),
        itemType: item.item_type,
        referenceId: item.workout_plan_id ?? item.activity_definition_id,
      })),
  }));
  const scheduledItems = resolveScheduleForWeek(
    weekDates,
    normalizedWeeklyItems,
    normalizedOverrides,
  );

  return scheduledItems.flatMap((item) => {
    if (item.itemType === 'rest' || !item.durationMinutes || !item.intensity) {
      return [];
    }

    if (item.itemType === 'workout') {
      return [
        {
          durationMinutes: item.durationMinutes,
          met: strengthTrainingMetByIntensity[item.intensity],
        },
      ];
    }

    const activity = item.referenceId ? activityById.get(item.referenceId) : null;

    return activity
      ? [
          {
            durationMinutes: item.durationMinutes,
            met: getActivityMet(activity, item.intensity),
          },
        ]
      : [];
  });
}

async function ensureNutritionTarget(
  userId: string,
  date: string,
  profile: ProfileRow,
  latestWeight: WeightLogRow | null,
  existingSnapshot: NutritionTargetSnapshotRow | null,
  plannedSessions: readonly PlannedTrainingSession[],
) {
  if (
    !latestWeight ||
    !profile.sex ||
    !profile.date_of_birth ||
    !profile.height_cm ||
    !profile.activity_level ||
    !profile.goal
  ) {
    return null;
  }

  const target = calculateNutritionTarget({
    activityLevel: profile.activity_level,
    calorieAdjustmentCalories: profile.calorie_adjustment_calories,
    dateOfBirth: profile.date_of_birth,
    goal: profile.goal,
    heightCm: profile.height_cm,
    plannedSessions,
    sex: profile.sex,
    targetDate: date,
    weightKg: latestWeight.weight_kg,
  });

  if (targetMatches(existingSnapshot, target)) {
    return existingSnapshot;
  }

  const { data, error } = await getSupabaseClient()
    .from('nutrition_target_snapshots')
    .upsert(
      {
        baseline_calories: target.baselineCalories,
        base_calories: target.baseCalories,
        calculation_version: nutritionCalculationVersion,
        calorie_adjustment_calories: target.calorieAdjustmentCalories,
        calories: target.calories,
        carbohydrate_grams: target.carbohydrateGrams,
        fat_grams: target.fatGrams,
        goal_adjustment_calories: target.goalAdjustmentCalories,
        planned_training_calories: target.plannedTrainingCalories,
        protein_grams: target.proteinGrams,
        resting_calories: target.restingCalories,
        target_date: date,
        user_id: userId,
      },
      { onConflict: 'user_id,target_date' },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchTodayData(
  userId: string,
  date: string,
  profile: ProfileRow,
): Promise<TodayData> {
  const client = getSupabaseClient();
  const { endIso, startIso } = getLocalDayBounds(date);
  const sevenDayStartIso = getSevenDayStartIso(date);
  const [
    activityResult,
    completedWorkoutResult,
    latestWeightResult,
    recentWeightResult,
    todayWeightResult,
    targetResult,
    plannedSessions,
  ] = await Promise.all([
    client
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('activity_date', date)
      .order('created_at'),
    client
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('session_date', date)
      .not('completed_at', 'is', null)
      .order('completed_at'),
    client
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', sevenDayStartIso)
      .lt('recorded_at', endIso)
      .order('recorded_at', { ascending: false }),
    client
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', startIso)
      .lt('recorded_at', endIso)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from('nutrition_target_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('target_date', date)
      .maybeSingle(),
    fetchPlannedTrainingSessions(userId, date),
  ]);

  const firstError = [
    activityResult.error,
    completedWorkoutResult.error,
    latestWeightResult.error,
    recentWeightResult.error,
    todayWeightResult.error,
    targetResult.error,
  ].find(Boolean);

  if (firstError) {
    throw firstError;
  }

  const latestWeight = latestWeightResult.data;
  const nutritionTarget = await ensureNutritionTarget(
    userId,
    date,
    profile,
    latestWeight,
    targetResult.data,
    plannedSessions,
  );

  return {
    activities: activityResult.data ?? [],
    completedWorkouts: completedWorkoutResult.data ?? [],
    latestWeight,
    nutritionTarget,
    sevenDayAverageKg: calculateSevenDayAverage(recentWeightResult.data ?? []),
    todayWeight: todayWeightResult.data,
  };
}

export async function fetchLastCompletedWorkoutDates(
  userId: string,
  planIds: readonly string[],
  beforeDate: string,
) {
  const entries = await Promise.all(
    [...new Set(planIds)].map(async (planId) => {
      const { data, error } = await getSupabaseClient()
        .from('workout_sessions')
        .select('session_date')
        .eq('user_id', userId)
        .eq('workout_plan_id', planId)
        .not('completed_at', 'is', null)
        .lt('session_date', beforeDate)
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return [planId, data?.session_date ?? null] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, string | null>;
}

export async function saveActivityLog(input: SaveActivityLogInput) {
  const { data, error } = await getSupabaseClient()
    .from('activity_logs')
    .insert({
      activity_date: input.activityDate,
      activity_definition_id: input.activityDefinitionId,
      activity_name_snapshot: input.activityName,
      duration_minutes: input.durationMinutes,
      intensity: input.intensity,
      user_id: input.userId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteActivityLog(activityLogId: string) {
  const { error } = await getSupabaseClient()
    .from('activity_logs')
    .delete()
    .eq('id', activityLogId);

  if (error) {
    throw error;
  }
}

export async function saveTodayWeight(input: SaveTodayWeightInput) {
  const client = getSupabaseClient();
  const query = input.existingLogId
    ? client.from('weight_logs').update({ weight_kg: input.weightKg }).eq('id', input.existingLogId)
    : client.from('weight_logs').insert({ user_id: input.userId, weight_kg: input.weightKg });
  const { data, error } = await query.select('*').single();

  if (error) {
    throw error;
  }

  return data;
}
