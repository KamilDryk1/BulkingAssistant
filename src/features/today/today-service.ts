import {
  calculateNutritionTarget,
  nutritionCalculationVersion,
} from '@/features/today/nutrition-domain';
import {
  calculateSevenDayAverage,
  getLocalDayBounds,
  getSevenDayStartIso,
} from '@/features/today/today-domain';
import { getSupabaseClient } from '@/services/supabase/get-client';
import type { NutritionTargetSnapshotRow, ProfileRow, WeightLogRow } from '@/types/database';

import type { SaveActivityLogInput, SaveTodayWeightInput, TodayData } from './today-types';

function targetMatches(
  snapshot: NutritionTargetSnapshotRow | null,
  target: ReturnType<typeof calculateNutritionTarget>,
) {
  return Boolean(
    snapshot &&
    snapshot.calculation_version === nutritionCalculationVersion &&
    snapshot.calories === target.calories &&
    snapshot.protein_grams === target.proteinGrams &&
    snapshot.carbohydrate_grams === target.carbohydrateGrams &&
    snapshot.fat_grams === target.fatGrams,
  );
}

async function ensureNutritionTarget(
  userId: string,
  date: string,
  profile: ProfileRow,
  latestWeight: WeightLogRow | null,
  existingSnapshot: NutritionTargetSnapshotRow | null,
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
    dateOfBirth: profile.date_of_birth,
    goal: profile.goal,
    heightCm: profile.height_cm,
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
        calculation_version: nutritionCalculationVersion,
        calories: target.calories,
        carbohydrate_grams: target.carbohydrateGrams,
        fat_grams: target.fatGrams,
        protein_grams: target.proteinGrams,
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
