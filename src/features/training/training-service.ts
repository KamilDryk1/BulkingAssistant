import { getSupabaseClient } from '@/services/supabase/get-client';
import type { AppLocale, Json } from '@/types/database';

import { getActivityDisplayName, getExerciseDisplayName } from './training-domain';
import type {
  CreateCustomActivityInput,
  CreateCustomExerciseInput,
  DailyScheduleOverride,
  SaveWorkoutPlanInput,
  ScheduleDraftItem,
  TrainingData,
} from './training-types';

function serializeScheduleItems(items: readonly ScheduleDraftItem[]): Json {
  return items.map((item) => ({
    duration_minutes: item.durationMinutes,
    intensity: item.intensity,
    item_type: item.itemType,
    reference_id: item.referenceId,
  }));
}

export async function fetchTrainingData(userId: string, locale: AppLocale): Promise<TrainingData> {
  const client = getSupabaseClient();
  const [exerciseResult, activityResult, planResult, planExerciseResult, weeklyResult] =
    await Promise.all([
      client.from('exercises').select('*'),
      client.from('activity_definitions').select('*'),
      client.from('workout_plans').select('*').eq('user_id', userId).order('created_at'),
      client.from('workout_plan_exercises').select('*').order('position'),
      client
        .from('weekly_schedule_items')
        .select('*')
        .eq('user_id', userId)
        .order('weekday')
        .order('position'),
    ]);

  const firstError = [
    exerciseResult.error,
    activityResult.error,
    planResult.error,
    planExerciseResult.error,
    weeklyResult.error,
  ].find(Boolean);

  if (firstError) {
    throw firstError;
  }

  const exercises = (exerciseResult.data ?? [])
    .map((exercise) => ({
      ...exercise,
      displayName: getExerciseDisplayName(exercise, locale),
    }))
    .sort((left, right) => {
      if (left.is_custom !== right.is_custom) {
        return left.is_custom ? -1 : 1;
      }

      return left.displayName.localeCompare(right.displayName, locale);
    });
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  const activities = (activityResult.data ?? [])
    .map((activity) => ({
      ...activity,
      displayName: getActivityDisplayName(activity, locale),
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, locale));

  const planExercises = planExerciseResult.data ?? [];
  const plans = (planResult.data ?? []).map((plan) => ({
    ...plan,
    exercises: planExercises
      .filter((item) => item.workout_plan_id === plan.id)
      .map((item) => {
        const exercise = exerciseById.get(item.exercise_id);
        return exercise
          ? {
              exercise,
              id: item.id,
              position: item.position,
            }
          : null;
      })
      .filter((item) => item !== null)
      .sort((left, right) => left.position - right.position),
  }));

  return {
    activities,
    exercises,
    plans,
    weeklySchedule: (weeklyResult.data ?? []).map((item) => ({
      durationMinutes: item.planned_duration_minutes,
      id: item.id,
      intensity: item.planned_intensity,
      itemType: item.item_type,
      position: item.position,
      referenceId: item.workout_plan_id ?? item.activity_definition_id,
      weekday: item.weekday,
    })),
  };
}

export async function fetchDailyScheduleOverride(
  userId: string,
  date: string,
): Promise<DailyScheduleOverride | null> {
  const client = getSupabaseClient();
  const { data: dailyOverride, error: overrideError } = await client
    .from('daily_schedule_overrides')
    .select('*')
    .eq('user_id', userId)
    .eq('scheduled_date', date)
    .maybeSingle();

  if (overrideError) {
    throw overrideError;
  }

  if (!dailyOverride) {
    return null;
  }

  const { data: items, error: itemsError } = await client
    .from('daily_schedule_override_items')
    .select('*')
    .eq('daily_override_id', dailyOverride.id)
    .order('position');

  if (itemsError) {
    throw itemsError;
  }

  return {
    date: dailyOverride.scheduled_date,
    id: dailyOverride.id,
    items: (items ?? []).map((item) => ({
      durationMinutes: item.planned_duration_minutes,
      intensity: item.planned_intensity,
      itemType: item.item_type,
      referenceId: item.workout_plan_id ?? item.activity_definition_id,
    })),
  };
}

export async function createCustomExercise(input: CreateCustomExerciseInput) {
  const { data, error } = await getSupabaseClient()
    .from('exercises')
    .insert({
      custom_name: input.name.trim(),
      equipment: input.equipment,
      is_custom: true,
      muscle_group: input.muscleGroup,
      owner_user_id: input.userId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createCustomActivity(input: CreateCustomActivityInput) {
  const { data, error } = await getSupabaseClient()
    .from('activity_definitions')
    .insert({
      custom_name: input.name.trim(),
      is_custom: true,
      owner_user_id: input.userId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteCustomExercise(exerciseId: string) {
  const { error } = await getSupabaseClient().rpc('delete_custom_exercise', {
    exercise_id_value: exerciseId,
  });

  if (error) {
    throw error;
  }
}

export async function saveWorkoutPlan(input: SaveWorkoutPlanInput) {
  const { data, error } = await getSupabaseClient().rpc('save_workout_plan', {
    ordered_exercise_ids: input.exerciseIds,
    workout_plan_id_value: input.planId,
    workout_plan_name: input.name.trim(),
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteWorkoutPlan(planId: string) {
  const { error } = await getSupabaseClient().from('workout_plans').delete().eq('id', planId);

  if (error) {
    throw error;
  }
}

export async function replaceWeeklyScheduleDay(
  weekday: number,
  items: readonly ScheduleDraftItem[],
) {
  const { data, error } = await getSupabaseClient().rpc('replace_weekly_schedule_day', {
    schedule_items: serializeScheduleItems(items),
    schedule_weekday: weekday,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function replaceDailyScheduleOverride(
  date: string,
  items: readonly ScheduleDraftItem[],
) {
  const { data, error } = await getSupabaseClient().rpc('replace_daily_schedule_override', {
    override_date: date,
    schedule_items: serializeScheduleItems(items),
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteDailyScheduleOverride(date: string) {
  const { error } = await getSupabaseClient().rpc('delete_daily_schedule_override', {
    override_date: date,
  });

  if (error) {
    throw error;
  }
}
