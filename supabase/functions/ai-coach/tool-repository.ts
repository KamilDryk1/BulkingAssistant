import type { SupabaseClient } from '@supabase/supabase-js';

import {
  formatDateInTimeZone,
  shiftAnalysisDateKey,
  summarizeDailyAnalysisWeights,
  type DailyAnalysisWeightSource,
} from '@/features/ai/daily-analysis-domain.ts';
import type { CoachToolArguments } from '@/features/ai/coach-tools.ts';
import { buildProgressSessionPoints } from '@/features/progress/progress-domain.ts';
import {
  getActivityDisplayName,
  getExerciseDisplayName,
} from '@/features/training/training-domain.ts';
import { formatLocalizedWeight, poundsToKilograms } from '@/features/units/weight.ts';
import type {
  Database,
  Json,
  ProfileRow,
  ScheduleItemType,
  WeightUnit,
  WorkoutPlanRow,
} from '@/types/database.ts';

type AppClient = SupabaseClient<Database>;

type ScheduleItem = {
  durationMinutes: number | null;
  intensity: 'light' | 'moderate' | 'hard' | null;
  itemType: ScheduleItemType;
  referenceId: string | null;
};

type EffectiveExercise = {
  equipment: string;
  id: string;
  muscleGroup: string;
  name: string;
};

type EffectiveWorkout = {
  exercises: EffectiveExercise[];
  name: string;
  planId: string | null;
  sessionId: string | null;
};

export type CoachToolOperation = {
  confirmationSummary: string | null;
  highLevelChange: string | null;
  result: unknown;
};

function failIfError(error: { message: string } | null, code: string) {
  if (error) {
    throw new Error(`${code}:${error.message}`);
  }
}

function getIsoWeekday(dateKey: string) {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function toWeightKg(weight: number, unit: WeightUnit) {
  const kilograms = unit === 'lb' ? poundsToKilograms(weight) : weight;
  const rounded = Math.round(kilograms * 1000) / 1000;
  if (rounded < 20 || rounded > 500) {
    throw new Error('WEIGHT_OUTSIDE_SUPPORTED_RANGE');
  }

  return rounded;
}

function formatExerciseList(exercises: readonly EffectiveExercise[]) {
  return exercises.map((exercise) => ({
    equipment: exercise.equipment,
    id: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
  }));
}

export class CoachToolRepository {
  private profilePromise: Promise<ProfileRow> | null = null;

  constructor(
    private readonly client: AppClient,
    private readonly userId: string,
    private readonly localDate: string,
    private readonly timeZone: string,
  ) {}

  private async getProfile() {
    if (!this.profilePromise) {
      this.profilePromise = (async () => {
        const { data, error } = await this.client
          .from('profiles')
          .select('*')
          .eq('user_id', this.userId)
          .single();
        failIfError(error, 'PROFILE_QUERY_FAILED');
        if (!data?.onboarding_completed_at) {
          throw new Error('PROFILE_NOT_READY');
        }

        return data;
      })();
    }

    return this.profilePromise;
  }

  private async getExercise(exerciseId: string) {
    const profile = await this.getProfile();
    const { data, error } = await this.client
      .from('exercises')
      .select('*')
      .eq('id', exerciseId)
      .maybeSingle();
    failIfError(error, 'EXERCISE_QUERY_FAILED');
    if (!data) {
      throw new Error('EXERCISE_NOT_FOUND');
    }

    return {
      row: data,
      value: {
        equipment: data.equipment,
        id: data.id,
        muscleGroup: data.muscle_group,
        name: getExerciseDisplayName(data, profile.locale),
      } satisfies EffectiveExercise,
    };
  }

  private async getPlan(planId: string) {
    const { data, error } = await this.client
      .from('workout_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', this.userId)
      .maybeSingle();
    failIfError(error, 'WORKOUT_PLAN_QUERY_FAILED');
    if (!data) {
      throw new Error('WORKOUT_PLAN_NOT_FOUND');
    }

    return data;
  }

  private async getExercisesByIds(exerciseIds: readonly string[]) {
    const profile = await this.getProfile();
    if (exerciseIds.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from('exercises')
      .select('*')
      .in('id', [...exerciseIds]);
    failIfError(error, 'EXERCISES_QUERY_FAILED');
    const byId = new Map((data ?? []).map((exercise) => [exercise.id, exercise]));
    if (byId.size !== new Set(exerciseIds).size) {
      throw new Error('ONE_OR_MORE_EXERCISES_NOT_FOUND');
    }

    return exerciseIds.map((id) => {
      const exercise = byId.get(id)!;
      return {
        equipment: exercise.equipment,
        id: exercise.id,
        muscleGroup: exercise.muscle_group,
        name: getExerciseDisplayName(exercise, profile.locale),
      } satisfies EffectiveExercise;
    });
  }

  private async getEffectivePlanExerciseIds(planId: string) {
    await this.getPlan(planId);
    const { data: dailyOverride, error: overrideError } = await this.client
      .from('daily_workout_exercise_overrides')
      .select('*')
      .eq('user_id', this.userId)
      .eq('override_date', this.localDate)
      .eq('workout_plan_id', planId)
      .maybeSingle();
    failIfError(overrideError, 'DAILY_WORKOUT_OVERRIDE_QUERY_FAILED');

    if (dailyOverride) {
      const { data, error } = await this.client
        .from('daily_workout_exercise_override_items')
        .select('*')
        .eq('daily_workout_override_id', dailyOverride.id)
        .order('position');
      failIfError(error, 'DAILY_WORKOUT_OVERRIDE_ITEMS_QUERY_FAILED');
      return (data ?? []).map((item) => item.exercise_id);
    }

    const { data, error } = await this.client
      .from('workout_plan_exercises')
      .select('*')
      .eq('workout_plan_id', planId)
      .order('position');
    failIfError(error, 'WORKOUT_PLAN_EXERCISES_QUERY_FAILED');
    return (data ?? []).map((item) => item.exercise_id);
  }

  private async getActiveSession() {
    const { data, error } = await this.client
      .from('workout_sessions')
      .select('*')
      .eq('user_id', this.userId)
      .is('completed_at', null)
      .maybeSingle();
    failIfError(error, 'ACTIVE_SESSION_QUERY_FAILED');
    return data;
  }

  private async getActiveWorkout(): Promise<EffectiveWorkout | null> {
    const session = await this.getActiveSession();
    if (!session) {
      return null;
    }

    const { data, error } = await this.client
      .from('workout_session_exercises')
      .select('*')
      .eq('workout_session_id', session.id)
      .order('position');
    failIfError(error, 'ACTIVE_SESSION_EXERCISES_QUERY_FAILED');

    return {
      exercises: (data ?? []).flatMap((exercise) =>
        exercise.exercise_id
          ? [
              {
                equipment: exercise.equipment_snapshot,
                id: exercise.exercise_id,
                muscleGroup: exercise.muscle_group_snapshot,
                name: exercise.exercise_name_snapshot,
              },
            ]
          : [],
      ),
      name: session.workout_name_snapshot,
      planId: session.workout_plan_id,
      sessionId: session.id,
    };
  }

  private async getTodayScheduleItems(): Promise<{ items: ScheduleItem[]; source: string }> {
    const { data: dailyOverride, error: overrideError } = await this.client
      .from('daily_schedule_overrides')
      .select('*')
      .eq('user_id', this.userId)
      .eq('scheduled_date', this.localDate)
      .maybeSingle();
    failIfError(overrideError, 'DAILY_SCHEDULE_OVERRIDE_QUERY_FAILED');

    if (dailyOverride) {
      const { data, error } = await this.client
        .from('daily_schedule_override_items')
        .select('*')
        .eq('daily_override_id', dailyOverride.id)
        .order('position');
      failIfError(error, 'DAILY_SCHEDULE_OVERRIDE_ITEMS_QUERY_FAILED');
      return {
        items: (data ?? []).map((item) => ({
          durationMinutes: item.planned_duration_minutes,
          intensity: item.planned_intensity,
          itemType: item.item_type,
          referenceId: item.workout_plan_id ?? item.activity_definition_id,
        })),
        source: 'daily_override',
      };
    }

    const { data, error } = await this.client
      .from('weekly_schedule_items')
      .select('*')
      .eq('user_id', this.userId)
      .eq('weekday', getIsoWeekday(this.localDate))
      .order('position');
    failIfError(error, 'WEEKLY_SCHEDULE_QUERY_FAILED');
    return {
      items: (data ?? []).map((item) => ({
        durationMinutes: item.planned_duration_minutes,
        intensity: item.planned_intensity,
        itemType: item.item_type,
        referenceId: item.workout_plan_id ?? item.activity_definition_id,
      })),
      source: 'weekly_schedule',
    };
  }

  private async getPlannedWorkouts() {
    const schedule = await this.getTodayScheduleItems();
    const workouts = await Promise.all(
      schedule.items.flatMap((item) =>
        item.itemType === 'workout' && item.referenceId
          ? [
              (async () => {
                const plan = await this.getPlan(item.referenceId!);
                const exerciseIds = await this.getEffectivePlanExerciseIds(plan.id);
                return {
                  exercises: await this.getExercisesByIds(exerciseIds),
                  name: plan.name,
                  planId: plan.id,
                  sessionId: null,
                } satisfies EffectiveWorkout;
              })(),
            ]
          : [],
      ),
    );

    return { ...schedule, workouts };
  }

  private async getTodayWeightRows() {
    const { data, error } = await this.client
      .from('weight_logs')
      .select('*')
      .eq('user_id', this.userId)
      .order('recorded_at', { ascending: false })
      .limit(100);
    failIfError(error, 'WEIGHT_LOGS_QUERY_FAILED');

    return (data ?? []).filter(
      (weight) =>
        formatDateInTimeZone(new Date(weight.recorded_at), this.timeZone) === this.localDate,
    );
  }

  async getTodayWorkout() {
    const active = await this.getActiveWorkout();
    if (active) {
      return {
        date: this.localDate,
        source: 'active_session',
        workouts: [{ ...active, exercises: formatExerciseList(active.exercises) }],
      };
    }

    const planned = await this.getPlannedWorkouts();
    return {
      date: this.localDate,
      scheduleItems: planned.items,
      source: planned.source,
      workouts: planned.workouts.map((workout) => ({
        ...workout,
        exercises: formatExerciseList(workout.exercises),
      })),
    };
  }

  private async getNutritionTarget() {
    const profile = await this.getProfile();
    const { data, error } = await this.client
      .from('nutrition_target_snapshots')
      .select('*')
      .eq('user_id', this.userId)
      .eq('target_date', this.localDate)
      .maybeSingle();
    failIfError(error, 'NUTRITION_TARGET_QUERY_FAILED');

    return {
      baseCalories: data?.base_calories ?? null,
      calorieAdjustment: profile.calorie_adjustment_calories,
      effectiveCalories: data?.calories ?? null,
      goal: profile.goal,
      macros: data
        ? {
            carbohydrateGrams: data.carbohydrate_grams,
            fatGrams: data.fat_grams,
            proteinGrams: data.protein_grams,
          }
        : null,
    };
  }

  private async getTodayContext() {
    const profile = await this.getProfile();
    const [workout, nutrition, activityResult, weights] = await Promise.all([
      this.getTodayWorkout(),
      this.getNutritionTarget(),
      this.client
        .from('activity_logs')
        .select('*')
        .eq('user_id', this.userId)
        .eq('activity_date', this.localDate)
        .order('created_at'),
      this.getTodayWeightRows(),
    ]);
    failIfError(activityResult.error, 'TODAY_ACTIVITIES_QUERY_FAILED');
    const weight = weights[0] ?? null;

    return {
      activities: (activityResult.data ?? []).map((activity) => ({
        date: activity.activity_date,
        durationMinutes: activity.duration_minutes,
        id: activity.id,
        intensity: activity.intensity,
        name: activity.activity_name_snapshot,
      })),
      date: this.localDate,
      goal: profile.goal,
      nutrition,
      weight: weight
        ? {
            display: `${formatLocalizedWeight(weight.weight_kg, profile.preferred_weight_unit, profile.locale)} ${profile.preferred_weight_unit}`,
            kg: weight.weight_kg,
            recordedAt: weight.recorded_at,
          }
        : null,
      workout,
    };
  }

  private async getWorkoutPlan(planId: string) {
    const plan = await this.getPlan(planId);
    const { data, error } = await this.client
      .from('workout_plan_exercises')
      .select('*')
      .eq('workout_plan_id', planId)
      .order('position');
    failIfError(error, 'WORKOUT_PLAN_EXERCISES_QUERY_FAILED');
    const exercises = await this.getExercisesByIds((data ?? []).map((item) => item.exercise_id));

    return {
      id: plan.id,
      name: plan.name,
      reusable: true,
      exercises: formatExerciseList(exercises),
    };
  }

  private async getRecentWorkouts(limit: number) {
    const { data: sessions, error } = await this.client
      .from('workout_sessions')
      .select('*')
      .eq('user_id', this.userId)
      .not('completed_at', 'is', null)
      .lte('session_date', this.localDate)
      .order('started_at', { ascending: false })
      .limit(limit);
    failIfError(error, 'RECENT_WORKOUTS_QUERY_FAILED');
    const sessionIds = (sessions ?? []).map((session) => session.id);
    if (sessionIds.length === 0) {
      return { sessions: [] };
    }

    const { data: exercises, error: exerciseError } = await this.client
      .from('workout_session_exercises')
      .select('*')
      .in('workout_session_id', sessionIds)
      .order('position');
    failIfError(exerciseError, 'RECENT_WORKOUT_EXERCISES_QUERY_FAILED');
    const exerciseIds = (exercises ?? []).map((exercise) => exercise.id);
    const setResult = exerciseIds.length
      ? await this.client
          .from('workout_sets')
          .select('*')
          .in('session_exercise_id', exerciseIds)
          .not('completed_at', 'is', null)
      : { data: [], error: null };
    failIfError(setResult.error, 'RECENT_WORKOUT_SETS_QUERY_FAILED');
    const sets = setResult.data ?? [];

    return {
      sessions: (sessions ?? []).map((session) => ({
        completedAt: session.completed_at,
        date: session.session_date,
        id: session.id,
        name: session.workout_name_snapshot,
        exercises: (exercises ?? [])
          .filter((exercise) => exercise.workout_session_id === session.id)
          .map((exercise) => ({
            id: exercise.exercise_id,
            name: exercise.exercise_name_snapshot,
            sets: sets
              .filter((set) => set.session_exercise_id === exercise.id)
              .slice(0, 8)
              .map((set) => ({ reps: set.reps, weightKg: set.weight_kg })),
          })),
      })),
    };
  }

  private async getExerciseProgress(exerciseId: string, sessionLimit: number) {
    const profile = await this.getProfile();
    const exercise = await this.getExercise(exerciseId);
    const { data: sessionExercises, error } = await this.client
      .from('workout_session_exercises')
      .select('*')
      .eq('exercise_id', exerciseId)
      .order('created_at', { ascending: false })
      .limit(120);
    failIfError(error, 'EXERCISE_PROGRESS_QUERY_FAILED');
    const sessionIds = [
      ...new Set((sessionExercises ?? []).map((item) => item.workout_session_id)),
    ];
    if (sessionIds.length === 0) {
      return { exercise: exercise.value, sessions: [], trend: null };
    }

    const { data: sessions, error: sessionError } = await this.client
      .from('workout_sessions')
      .select('*')
      .eq('user_id', this.userId)
      .in('id', sessionIds)
      .not('completed_at', 'is', null)
      .lte('session_date', this.localDate)
      .order('started_at');
    failIfError(sessionError, 'EXERCISE_PROGRESS_SESSIONS_QUERY_FAILED');
    const recentSessions = (sessions ?? []).slice(-sessionLimit);
    const completedSessionIds = new Set(recentSessions.map((session) => session.id));
    const relevantExercises = (sessionExercises ?? []).filter((item) =>
      completedSessionIds.has(item.workout_session_id),
    );
    const sessionExerciseIds = relevantExercises.map((item) => item.id);
    const setResult = sessionExerciseIds.length
      ? await this.client
          .from('workout_sets')
          .select('*')
          .in('session_exercise_id', sessionExerciseIds)
          .not('completed_at', 'is', null)
      : { data: [], error: null };
    failIfError(setResult.error, 'EXERCISE_PROGRESS_SETS_QUERY_FAILED');
    const sessionById = new Map(recentSessions.map((session) => [session.id, session]));
    const sessionExerciseById = new Map(relevantExercises.map((item) => [item.id, item]));
    const points = buildProgressSessionPoints(
      (setResult.data ?? []).flatMap((set) => {
        const sessionExercise = sessionExerciseById.get(set.session_exercise_id);
        const session = sessionExercise
          ? sessionById.get(sessionExercise.workout_session_id)
          : null;
        return session
          ? [
              {
                completedAt: set.completed_at,
                exerciseId,
                reps: set.reps,
                sessionDate: session.session_date,
                sessionId: session.id,
                sessionStartedAt: session.started_at,
                setId: set.id,
                weightKg: set.weight_kg,
              },
            ]
          : [];
      }),
      exerciseId,
    ).slice(-sessionLimit);

    return {
      exercise: exercise.value,
      sessions: points.map((point) => ({
        bestSet: {
          reps: point.bestSet.reps,
          weight: `${formatLocalizedWeight(point.bestSet.weightKg, profile.preferred_weight_unit, profile.locale)} ${profile.preferred_weight_unit}`,
          weightKg: point.bestSet.weightKg,
        },
        date: point.date,
        estimatedOneRepMax: `${formatLocalizedWeight(point.estimatedOneRepMaxKg, profile.preferred_weight_unit, profile.locale)} ${profile.preferred_weight_unit}`,
        estimatedOneRepMaxKg: Math.round(point.estimatedOneRepMaxKg * 100) / 100,
        sessionId: point.sessionId,
      })),
      trend:
        points.length >= 2
          ? {
              estimatedOneRepMaxChangeKg:
                Math.round(
                  (points.at(-1)!.estimatedOneRepMaxKg - points[0].estimatedOneRepMaxKg) * 100,
                ) / 100,
              from: points[0].date,
              to: points.at(-1)!.date,
            }
          : null,
    };
  }

  private async getWeightTrend() {
    const profile = await this.getProfile();
    const timestampStart = `${shiftAnalysisDateKey(this.localDate, -35)}T00:00:00.000Z`;
    const { data, error } = await this.client
      .from('weight_logs')
      .select('*')
      .eq('user_id', this.userId)
      .gte('recorded_at', timestampStart)
      .order('recorded_at');
    failIfError(error, 'WEIGHT_TREND_QUERY_FAILED');
    const source: DailyAnalysisWeightSource[] = (data ?? []).map((weight) => ({
      date: formatDateInTimeZone(new Date(weight.recorded_at), this.timeZone),
      recordedAt: weight.recorded_at,
      weightKg: weight.weight_kg,
    }));

    return summarizeDailyAnalysisWeights(
      source,
      this.localDate,
      profile.preferred_weight_unit,
      profile.locale,
    );
  }

  private async searchExercises(
    query: string | null,
    muscleGroup: string | null,
    equipment: string | null,
    limit: number,
  ) {
    const profile = await this.getProfile();
    const { data, error } = await this.client.from('exercises').select('*').limit(500);
    failIfError(error, 'EXERCISE_SEARCH_FAILED');
    const normalizedQuery = query?.toLocaleLowerCase(profile.locale) ?? null;

    return (data ?? [])
      .map((exercise) => ({
        equipment: exercise.equipment,
        id: exercise.id,
        muscleGroup: exercise.muscle_group,
        name: getExerciseDisplayName(exercise, profile.locale),
      }))
      .filter(
        (exercise) =>
          (!normalizedQuery ||
            exercise.name.toLocaleLowerCase(profile.locale).includes(normalizedQuery)) &&
          (!muscleGroup || exercise.muscleGroup === muscleGroup) &&
          (!equipment || exercise.equipment === equipment),
      )
      .slice(0, limit);
  }

  private async getActivityDefinitions(query: string | null, limit: number) {
    const profile = await this.getProfile();
    const { data, error } = await this.client.from('activity_definitions').select('*').limit(500);
    failIfError(error, 'ACTIVITY_SEARCH_FAILED');
    const normalizedQuery = query?.toLocaleLowerCase(profile.locale) ?? null;

    return (data ?? [])
      .map((activity) => ({
        id: activity.id,
        name: getActivityDisplayName(activity, profile.locale),
      }))
      .filter(
        (activity) =>
          !normalizedQuery ||
          activity.name.toLocaleLowerCase(profile.locale).includes(normalizedQuery),
      )
      .slice(0, limit);
  }

  private async getTodayExerciseIds(planId: string) {
    const active = await this.getActiveWorkout();
    if (active) {
      if (active.planId !== planId) {
        throw new Error('WORKOUT_PLAN_IS_NOT_THE_ACTIVE_SESSION');
      }

      return { active: true, ids: active.exercises.map((exercise) => exercise.id) };
    }

    const planned = await this.getPlannedWorkouts();
    const workout = planned.workouts.find((candidate) => candidate.planId === planId);
    if (!workout) {
      throw new Error('WORKOUT_PLAN_IS_NOT_SCHEDULED_TODAY');
    }

    return { active: false, ids: workout.exercises.map((exercise) => exercise.id) };
  }

  private async saveTodayExerciseIds(planId: string, ids: readonly string[], active: boolean) {
    const result = active
      ? await this.client.rpc('replace_active_workout_session_exercises', {
          ordered_exercise_ids: [...ids],
        })
      : await this.client.rpc('replace_daily_workout_exercises', {
          ordered_exercise_ids: [...ids],
          override_date_value: this.localDate,
          workout_plan_id_value: planId,
        });
    failIfError(result.error, 'TODAY_WORKOUT_UPDATE_FAILED');
  }

  private async replaceExerciseForToday(
    planId: string,
    sourceExerciseId: string,
    replacementExerciseId: string,
  ) {
    const state = await this.getTodayExerciseIds(planId);
    const [source, replacement, plan] = await Promise.all([
      this.getExercise(sourceExerciseId),
      this.getExercise(replacementExerciseId),
      this.getPlan(planId),
    ]);
    const sourceIndex = state.ids.indexOf(sourceExerciseId);
    if (sourceIndex < 0) {
      if (state.ids.includes(replacementExerciseId)) {
        const profile = await this.getProfile();
        const change =
          profile.locale === 'pl'
            ? `${replacement.value.name} jest już w dzisiejszym treningu ${plan.name}; szablon planu pozostał bez zmian.`
            : `${replacement.value.name} is already in today's ${plan.name} workout; the reusable plan is unchanged.`;
        return {
          confirmationSummary: null,
          highLevelChange: change,
          result: { changed: { scope: 'today_only' }, success: true },
        };
      }
      throw new Error('SOURCE_EXERCISE_NOT_FOUND_IN_TODAY_WORKOUT');
    }
    if (state.ids.includes(replacementExerciseId)) {
      throw new Error('REPLACEMENT_EXERCISE_ALREADY_IN_TODAY_WORKOUT');
    }
    const nextIds = [...state.ids];
    nextIds[sourceIndex] = replacementExerciseId;
    await this.saveTodayExerciseIds(planId, nextIds, state.active);
    const profile = await this.getProfile();
    const change =
      profile.locale === 'pl'
        ? `W dzisiejszym treningu ${plan.name} zamieniono ${source.value.name} na ${replacement.value.name}. Szablon planu pozostał bez zmian.`
        : `Replaced ${source.value.name} with ${replacement.value.name} in today's ${plan.name} workout. The reusable plan is unchanged.`;

    return {
      confirmationSummary: null,
      highLevelChange: change,
      result: {
        changed: { from: source.value.name, scope: 'today_only', to: replacement.value.name },
        success: true,
      },
    };
  }

  private async addExerciseForToday(
    planId: string,
    exerciseId: string,
    afterExerciseId: string | null,
  ) {
    const state = await this.getTodayExerciseIds(planId);
    const [exercise, plan] = await Promise.all([
      this.getExercise(exerciseId),
      this.getPlan(planId),
    ]);
    if (state.ids.includes(exerciseId)) {
      const profile = await this.getProfile();
      const change =
        profile.locale === 'pl'
          ? `${exercise.value.name} jest już w dzisiejszym treningu ${plan.name}.`
          : `${exercise.value.name} is already in today's ${plan.name} workout.`;
      return {
        confirmationSummary: null,
        highLevelChange: change,
        result: { changed: { scope: 'today_only' }, success: true },
      };
    }
    const insertionIndex =
      afterExerciseId === null ? state.ids.length : state.ids.indexOf(afterExerciseId) + 1;
    if (insertionIndex <= 0 && afterExerciseId !== null) {
      throw new Error('ANCHOR_EXERCISE_NOT_FOUND_IN_TODAY_WORKOUT');
    }
    const nextIds = [...state.ids];
    nextIds.splice(insertionIndex, 0, exerciseId);
    await this.saveTodayExerciseIds(planId, nextIds, state.active);
    const profile = await this.getProfile();
    const change =
      profile.locale === 'pl'
        ? `Dodano ${exercise.value.name} tylko do dzisiejszego treningu ${plan.name}.`
        : `Added ${exercise.value.name} to today's ${plan.name} workout only.`;
    return {
      confirmationSummary: null,
      highLevelChange: change,
      result: { changed: { added: exercise.value.name, scope: 'today_only' }, success: true },
    };
  }

  private async removeExerciseForToday(planId: string, exerciseId: string) {
    const state = await this.getTodayExerciseIds(planId);
    const [exercise, plan] = await Promise.all([
      this.getExercise(exerciseId),
      this.getPlan(planId),
    ]);
    if (!state.ids.includes(exerciseId)) {
      const profile = await this.getProfile();
      const change =
        profile.locale === 'pl'
          ? `${exercise.value.name} nie ma już w dzisiejszym treningu ${plan.name}.`
          : `${exercise.value.name} is already absent from today's ${plan.name} workout.`;
      return {
        confirmationSummary: null,
        highLevelChange: change,
        result: { changed: { scope: 'today_only' }, success: true },
      };
    }
    if (state.ids.length === 1) {
      throw new Error('TODAY_WORKOUT_CANNOT_BE_EMPTY');
    }
    await this.saveTodayExerciseIds(
      planId,
      state.ids.filter((id) => id !== exerciseId),
      state.active,
    );
    const profile = await this.getProfile();
    const change =
      profile.locale === 'pl'
        ? `Usunięto ${exercise.value.name} tylko z dzisiejszego treningu ${plan.name}.`
        : `Removed ${exercise.value.name} from today's ${plan.name} workout only.`;
    return {
      confirmationSummary: null,
      highLevelChange: change,
      result: { changed: { removed: exercise.value.name, scope: 'today_only' }, success: true },
    };
  }

  private async changeTodayWorkout(
    planId: string,
    durationMinutes: number,
    intensity: 'light' | 'moderate' | 'hard',
  ) {
    const plan = await this.getPlan(planId);
    const schedule = await this.getTodayScheduleItems();
    const retainedActivities = schedule.items.filter((item) => item.itemType === 'activity');
    const items: Json = [
      {
        duration_minutes: durationMinutes,
        intensity,
        item_type: 'workout',
        reference_id: planId,
      },
      ...retainedActivities.map((item) => ({
        duration_minutes: item.durationMinutes,
        intensity: item.intensity,
        item_type: item.itemType,
        reference_id: item.referenceId,
      })),
    ];
    const { error } = await this.client.rpc('replace_daily_schedule_override', {
      override_date: this.localDate,
      schedule_items: items,
    });
    failIfError(error, 'TODAY_SCHEDULE_UPDATE_FAILED');
    const profile = await this.getProfile();
    const change =
      profile.locale === 'pl'
        ? `Na dziś ustawiono trening ${plan.name}. Harmonogram tygodniowy pozostał bez zmian.`
        : `Set ${plan.name} as today's workout. The weekly schedule is unchanged.`;
    return {
      confirmationSummary: null,
      highLevelChange: change,
      result: { changed: { scope: 'today_only', workout: plan.name }, success: true },
    };
  }

  private async addActivity(
    activityDefinitionId: string,
    durationMinutes: number,
    intensity: 'light' | 'moderate' | 'hard',
    idempotencyKey: string,
  ) {
    const profile = await this.getProfile();
    const { data: definition, error: definitionError } = await this.client
      .from('activity_definitions')
      .select('*')
      .eq('id', activityDefinitionId)
      .maybeSingle();
    failIfError(definitionError, 'ACTIVITY_DEFINITION_QUERY_FAILED');
    if (!definition) {
      throw new Error('ACTIVITY_DEFINITION_NOT_FOUND');
    }
    const name = getActivityDisplayName(definition, profile.locale);
    const { data, error } = await this.client
      .from('activity_logs')
      .upsert({
        activity_date: this.localDate,
        activity_definition_id: definition.id,
        activity_name_snapshot: name,
        duration_minutes: durationMinutes,
        id: idempotencyKey,
        intensity,
        user_id: this.userId,
      })
      .select('*')
      .single();
    failIfError(error, 'ACTIVITY_LOG_WRITE_FAILED');
    const change =
      profile.locale === 'pl'
        ? `Dodano dziś ${name}: ${durationMinutes} min, intensywność ${intensity}.`
        : `Logged ${name} today: ${durationMinutes} min, ${intensity} intensity.`;
    return {
      confirmationSummary: null,
      highLevelChange: change,
      result: { activity: { id: data!.id, intensity, name, durationMinutes }, success: true },
    };
  }

  private async editActivity(
    activityLogId: string,
    durationMinutes: number,
    intensity: 'light' | 'moderate' | 'hard',
  ) {
    const { data: existing, error: existingError } = await this.client
      .from('activity_logs')
      .select('*')
      .eq('id', activityLogId)
      .eq('user_id', this.userId)
      .eq('activity_date', this.localDate)
      .maybeSingle();
    failIfError(existingError, 'ACTIVITY_LOG_QUERY_FAILED');
    if (!existing) {
      throw new Error('TODAY_ACTIVITY_LOG_NOT_FOUND');
    }
    const { data, error } = await this.client
      .from('activity_logs')
      .update({ duration_minutes: durationMinutes, intensity })
      .eq('id', existing.id)
      .eq('user_id', this.userId)
      .select('*')
      .single();
    failIfError(error, 'ACTIVITY_LOG_UPDATE_FAILED');
    const profile = await this.getProfile();
    const change =
      profile.locale === 'pl'
        ? `Zaktualizowano dzisiejszą aktywność ${existing.activity_name_snapshot}: ${durationMinutes} min, intensywność ${intensity}.`
        : `Updated today's ${existing.activity_name_snapshot}: ${durationMinutes} min, ${intensity} intensity.`;
    return {
      confirmationSummary: null,
      highLevelChange: change,
      result: { activity: { id: data!.id, intensity, durationMinutes }, success: true },
    };
  }

  private async logWeight(weight: number, unit: WeightUnit, update: boolean) {
    const profile = await this.getProfile();
    const existing = (await this.getTodayWeightRows())[0] ?? null;
    const weightKg = toWeightKg(weight, unit);
    if (update && !existing) {
      throw new Error('TODAY_WEIGHT_NOT_FOUND');
    }
    if (!update && existing && Math.abs(existing.weight_kg - weightKg) >= 0.0005) {
      throw new Error('TODAY_WEIGHT_ALREADY_EXISTS');
    }
    const operation = existing
      ? this.client
          .from('weight_logs')
          .update({ weight_kg: weightKg })
          .eq('id', existing.id)
          .eq('user_id', this.userId)
      : this.client.from('weight_logs').insert({ user_id: this.userId, weight_kg: weightKg });
    const { data, error } = await operation.select('*').single();
    failIfError(error, 'WEIGHT_LOG_WRITE_FAILED');
    const display = `${formatLocalizedWeight(weightKg, profile.preferred_weight_unit, profile.locale)} ${profile.preferred_weight_unit}`;
    const change =
      profile.locale === 'pl'
        ? `${existing ? 'Zaktualizowano' : 'Zapisano'} dzisiejszą wagę: ${display}.`
        : `${existing ? 'Updated' : 'Logged'} today's weight: ${display}.`;
    return {
      confirmationSummary: null,
      highLevelChange: change,
      result: { success: true, weight: { display, id: data!.id, kg: weightKg } },
    };
  }

  async execute(tool: CoachToolArguments, idempotencyKey: string): Promise<CoachToolOperation> {
    switch (tool.name) {
      case 'get_today_context':
        return {
          confirmationSummary: null,
          highLevelChange: null,
          result: await this.getTodayContext(),
        };
      case 'get_today_workout':
        return {
          confirmationSummary: null,
          highLevelChange: null,
          result: await this.getTodayWorkout(),
        };
      case 'get_workout_plan':
        return {
          confirmationSummary: null,
          highLevelChange: null,
          result: await this.getWorkoutPlan(tool.arguments.workoutPlanId),
        };
      case 'get_recent_workouts':
        return {
          confirmationSummary: null,
          highLevelChange: null,
          result: await this.getRecentWorkouts(tool.arguments.limit),
        };
      case 'get_exercise_progress':
        return {
          confirmationSummary: null,
          highLevelChange: null,
          result: await this.getExerciseProgress(
            tool.arguments.exerciseId,
            tool.arguments.sessionLimit,
          ),
        };
      case 'get_weight_trend':
        return {
          confirmationSummary: null,
          highLevelChange: null,
          result: await this.getWeightTrend(),
        };
      case 'get_nutrition_target':
        return {
          confirmationSummary: null,
          highLevelChange: null,
          result: await this.getNutritionTarget(),
        };
      case 'search_exercises':
        return {
          confirmationSummary: null,
          highLevelChange: null,
          result: await this.searchExercises(
            tool.arguments.query,
            tool.arguments.muscleGroup,
            tool.arguments.equipment,
            tool.arguments.limit,
          ),
        };
      case 'get_activity_definitions':
        return {
          confirmationSummary: null,
          highLevelChange: null,
          result: await this.getActivityDefinitions(tool.arguments.query, tool.arguments.limit),
        };
      case 'replace_exercise_for_today':
        return this.replaceExerciseForToday(
          tool.arguments.workoutPlanId,
          tool.arguments.exerciseToReplaceId,
          tool.arguments.replacementExerciseId,
        );
      case 'add_exercise_for_today':
        return this.addExerciseForToday(
          tool.arguments.workoutPlanId,
          tool.arguments.exerciseId,
          tool.arguments.afterExerciseId,
        );
      case 'remove_exercise_for_today':
        return this.removeExerciseForToday(tool.arguments.workoutPlanId, tool.arguments.exerciseId);
      case 'change_today_workout':
        return this.changeTodayWorkout(
          tool.arguments.workoutPlanId,
          tool.arguments.durationMinutes,
          tool.arguments.intensity,
        );
      case 'add_activity':
        return this.addActivity(
          tool.arguments.activityDefinitionId,
          tool.arguments.durationMinutes,
          tool.arguments.intensity,
          idempotencyKey,
        );
      case 'edit_activity':
        return this.editActivity(
          tool.arguments.activityLogId,
          tool.arguments.durationMinutes,
          tool.arguments.intensity,
        );
      case 'log_weight':
        return this.logWeight(tool.arguments.weight, tool.arguments.unit, false);
      case 'update_today_weight':
        return this.logWeight(tool.arguments.weight, tool.arguments.unit, true);
      case 'create_workout_plan':
      case 'update_workout_plan':
      case 'update_nutrition_adjustment':
        return this.preparePersistent(tool);
    }
  }

  async preparePersistent(
    tool: Extract<
      CoachToolArguments,
      { name: 'create_workout_plan' | 'update_workout_plan' | 'update_nutrition_adjustment' }
    >,
  ): Promise<CoachToolOperation> {
    const profile = await this.getProfile();
    if (tool.name === 'update_nutrition_adjustment') {
      const current = profile.calorie_adjustment_calories;
      const next = tool.arguments.calorieAdjustment;
      const summary =
        profile.locale === 'pl'
          ? `Trwale zmień korektę kalorii z ${current} kcal na ${next} kcal. Dane profilu i wzór BMR pozostaną bez zmian.`
          : `Permanently change the calorie adjustment from ${current} kcal to ${next} kcal. Profile inputs and the BMR formula stay unchanged.`;
      return {
        confirmationSummary: summary,
        highLevelChange: null,
        result: {
          confirmationRequired: true,
          proposed: { from: current, to: next, unit: 'kcal' },
          summary,
        },
      };
    }

    const exercises = await this.getExercisesByIds(tool.arguments.exerciseIds);
    const plan: WorkoutPlanRow | null =
      tool.name === 'update_workout_plan' ? await this.getPlan(tool.arguments.workoutPlanId) : null;
    const names = exercises.map((exercise) => exercise.name).join(', ');
    const summary =
      profile.locale === 'pl'
        ? plan
          ? `Trwale zaktualizuj plan ${plan.name}: nazwa „${tool.arguments.name}”, ćwiczenia w kolejności: ${names}.`
          : `Utwórz trwały plan „${tool.arguments.name}” z ćwiczeniami w kolejności: ${names}.`
        : plan
          ? `Permanently update ${plan.name}: name “${tool.arguments.name}”, exercises in order: ${names}.`
          : `Create the reusable plan “${tool.arguments.name}” with exercises in order: ${names}.`;
    return {
      confirmationSummary: summary,
      highLevelChange: null,
      result: {
        confirmationRequired: true,
        proposed: {
          exerciseCount: exercises.length,
          name: tool.arguments.name,
          planId: plan?.id ?? null,
        },
        summary,
      },
    };
  }

  async executePersistent(
    tool: Extract<
      CoachToolArguments,
      { name: 'create_workout_plan' | 'update_workout_plan' | 'update_nutrition_adjustment' }
    >,
    idempotencyKey: string,
  ): Promise<CoachToolOperation> {
    const profile = await this.getProfile();
    if (tool.name === 'update_nutrition_adjustment') {
      const previous = profile.calorie_adjustment_calories;
      const { error } = await this.client
        .from('profiles')
        .update({ calorie_adjustment_calories: tool.arguments.calorieAdjustment })
        .eq('user_id', this.userId);
      failIfError(error, 'NUTRITION_ADJUSTMENT_UPDATE_FAILED');
      const change =
        profile.locale === 'pl'
          ? `Korekta kalorii została zmieniona z ${previous} kcal na ${tool.arguments.calorieAdjustment} kcal.`
          : `The calorie adjustment was changed from ${previous} kcal to ${tool.arguments.calorieAdjustment} kcal.`;
      return {
        confirmationSummary: null,
        highLevelChange: change,
        result: {
          changed: { from: previous, to: tool.arguments.calorieAdjustment, unit: 'kcal' },
          success: true,
        },
      };
    }

    await this.getExercisesByIds(tool.arguments.exerciseIds);
    const planId = tool.name === 'update_workout_plan' ? tool.arguments.workoutPlanId : null;
    if (planId) {
      await this.getPlan(planId);
    }
    const { data, error } = planId
      ? await this.client.rpc('save_workout_plan', {
          ordered_exercise_ids: tool.arguments.exerciseIds,
          workout_plan_id_value: planId,
          workout_plan_name: tool.arguments.name,
        })
      : await this.client.rpc('save_ai_workout_plan', {
          idempotency_plan_id: idempotencyKey,
          ordered_exercise_ids: tool.arguments.exerciseIds,
          workout_plan_name: tool.arguments.name,
        });
    failIfError(error, 'WORKOUT_PLAN_SAVE_FAILED');
    const change =
      profile.locale === 'pl'
        ? `${planId ? 'Zaktualizowano' : 'Utworzono'} plan „${tool.arguments.name}” (${tool.arguments.exerciseIds.length} ćwiczeń).`
        : `${planId ? 'Updated' : 'Created'} the “${tool.arguments.name}” plan (${tool.arguments.exerciseIds.length} exercises).`;
    return {
      confirmationSummary: null,
      highLevelChange: change,
      result: {
        changed: {
          exerciseCount: tool.arguments.exerciseIds.length,
          name: tool.arguments.name,
          planId: data!.id,
        },
        success: true,
      },
    };
  }
}
