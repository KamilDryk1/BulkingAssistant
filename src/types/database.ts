export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppLocale = 'en' | 'pl';
export type WeightUnit = 'kg' | 'lb';
export type ProfileSex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extremely_active';
export type FitnessGoal = 'cut' | 'maintain' | 'gain';
export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'biceps' | 'triceps' | 'core';
export type EquipmentCategory =
  'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other';
export type ScheduleItemType = 'workout' | 'activity' | 'rest';
export type ActivityIntensity = 'light' | 'moderate' | 'hard';
export type AiAnalysisStatus = 'pending' | 'failed' | 'no_action' | 'suggestion';
export type AiAnalysisCategory =
  'none' | 'nutrition' | 'training' | 'recovery' | 'adherence' | 'activity';
export type AiAnalysisPriority = 'low' | 'medium' | 'high';
export type AiAnalysisConfidence = 'low' | 'medium' | 'high';
export type AiAnalysisOutcomeReason = 'model' | 'insufficient_data' | 'disabled' | 'mock';

export type ProfileRow = {
  activity_level: ActivityLevel | null;
  calorie_adjustment_calories: number;
  created_at: string;
  date_of_birth: string | null;
  goal: FitnessGoal | null;
  goal_changed_at: string | null;
  height_cm: number | null;
  locale: AppLocale;
  onboarding_completed_at: string | null;
  preferred_weight_unit: WeightUnit;
  sex: ProfileSex | null;
  updated_at: string;
  user_id: string;
};

type ProfileInsert = {
  activity_level?: ActivityLevel | null;
  calorie_adjustment_calories?: number;
  created_at?: string;
  date_of_birth?: string | null;
  goal?: FitnessGoal | null;
  goal_changed_at?: string | null;
  height_cm?: number | null;
  locale?: AppLocale;
  onboarding_completed_at?: string | null;
  preferred_weight_unit?: WeightUnit;
  sex?: ProfileSex | null;
  updated_at?: string;
  user_id: string;
};

type ProfileUpdate = Partial<ProfileInsert>;

export type ExerciseRow = {
  created_at: string;
  custom_name: string | null;
  equipment: EquipmentCategory;
  id: string;
  is_custom: boolean;
  muscle_group: MuscleGroup;
  name_en: string | null;
  name_pl: string | null;
  owner_user_id: string | null;
  slug: string | null;
  updated_at: string;
};

type ExerciseInsert = {
  created_at?: string;
  custom_name?: string | null;
  equipment: EquipmentCategory;
  id?: string;
  is_custom?: boolean;
  muscle_group: MuscleGroup;
  name_en?: string | null;
  name_pl?: string | null;
  owner_user_id?: string | null;
  slug?: string | null;
  updated_at?: string;
};

export type ActivityDefinitionRow = {
  created_at: string;
  custom_name: string | null;
  id: string;
  is_custom: boolean;
  met_hard: number;
  met_light: number;
  met_moderate: number;
  name_en: string | null;
  name_pl: string | null;
  owner_user_id: string | null;
  slug: string | null;
  updated_at: string;
};

type ActivityDefinitionInsert = {
  created_at?: string;
  custom_name?: string | null;
  id?: string;
  is_custom?: boolean;
  met_hard?: number;
  met_light?: number;
  met_moderate?: number;
  name_en?: string | null;
  name_pl?: string | null;
  owner_user_id?: string | null;
  slug?: string | null;
  updated_at?: string;
};

export type WorkoutPlanRow = {
  created_at: string;
  id: string;
  name: string;
  updated_at: string;
  user_id: string;
};

type WorkoutPlanInsert = {
  created_at?: string;
  id?: string;
  name: string;
  updated_at?: string;
  user_id: string;
};

export type WorkoutPlanExerciseRow = {
  created_at: string;
  exercise_id: string;
  id: string;
  position: number;
  updated_at: string;
  workout_plan_id: string;
};

type WorkoutPlanExerciseInsert = {
  created_at?: string;
  exercise_id: string;
  id?: string;
  position: number;
  updated_at?: string;
  workout_plan_id: string;
};

export type WeeklyScheduleItemRow = {
  activity_definition_id: string | null;
  created_at: string;
  id: string;
  item_type: ScheduleItemType;
  planned_duration_minutes: number | null;
  planned_intensity: ActivityIntensity | null;
  position: number;
  updated_at: string;
  user_id: string;
  weekday: number;
  workout_plan_id: string | null;
};

type WeeklyScheduleItemInsert = {
  activity_definition_id?: string | null;
  created_at?: string;
  id?: string;
  item_type: ScheduleItemType;
  planned_duration_minutes?: number | null;
  planned_intensity?: ActivityIntensity | null;
  position?: number;
  updated_at?: string;
  user_id: string;
  weekday: number;
  workout_plan_id?: string | null;
};

export type DailyScheduleOverrideRow = {
  created_at: string;
  id: string;
  scheduled_date: string;
  updated_at: string;
  user_id: string;
};

type DailyScheduleOverrideInsert = {
  created_at?: string;
  id?: string;
  scheduled_date: string;
  updated_at?: string;
  user_id: string;
};

export type DailyScheduleOverrideItemRow = {
  activity_definition_id: string | null;
  created_at: string;
  daily_override_id: string;
  id: string;
  item_type: ScheduleItemType;
  planned_duration_minutes: number | null;
  planned_intensity: ActivityIntensity | null;
  position: number;
  updated_at: string;
  workout_plan_id: string | null;
};

type DailyScheduleOverrideItemInsert = {
  activity_definition_id?: string | null;
  created_at?: string;
  daily_override_id: string;
  id?: string;
  item_type: ScheduleItemType;
  planned_duration_minutes?: number | null;
  planned_intensity?: ActivityIntensity | null;
  position?: number;
  updated_at?: string;
  workout_plan_id?: string | null;
};

export type WorkoutSessionRow = {
  completed_at: string | null;
  created_at: string;
  id: string;
  session_date: string;
  started_at: string;
  updated_at: string;
  user_id: string;
  workout_name_snapshot: string;
  workout_plan_id: string | null;
};

type WorkoutSessionInsert = {
  completed_at?: string | null;
  created_at?: string;
  id?: string;
  session_date?: string;
  started_at?: string;
  updated_at?: string;
  user_id: string;
  workout_name_snapshot: string;
  workout_plan_id?: string | null;
};

export type WorkoutSessionExerciseRow = {
  created_at: string;
  equipment_snapshot: EquipmentCategory;
  exercise_id: string | null;
  exercise_name_snapshot: string;
  id: string;
  muscle_group_snapshot: MuscleGroup;
  position: number;
  updated_at: string;
  workout_session_id: string;
};

type WorkoutSessionExerciseInsert = {
  created_at?: string;
  equipment_snapshot: EquipmentCategory;
  exercise_id?: string | null;
  exercise_name_snapshot: string;
  id?: string;
  muscle_group_snapshot: MuscleGroup;
  position: number;
  updated_at?: string;
  workout_session_id: string;
};

export type WorkoutSetRow = {
  completed_at: string | null;
  created_at: string;
  id: string;
  reps: number;
  session_exercise_id: string;
  set_number: number;
  updated_at: string;
  weight_kg: number;
};

type WorkoutSetInsert = {
  completed_at?: string | null;
  created_at?: string;
  id?: string;
  reps: number;
  session_exercise_id: string;
  set_number: number;
  updated_at?: string;
  weight_kg: number;
};

export type PreviousExercisePerformanceRow = {
  exercise_id: string;
  previous_session_date: string;
  reps: number;
  set_number: number;
  weight_kg: number;
};

export type ActivityLogRow = {
  activity_date: string;
  activity_definition_id: string | null;
  activity_name_snapshot: string;
  created_at: string;
  duration_minutes: number | null;
  id: string;
  intensity: ActivityIntensity | null;
  updated_at: string;
  user_id: string;
};

type ActivityLogInsert = {
  activity_date?: string;
  activity_definition_id?: string | null;
  activity_name_snapshot: string;
  created_at?: string;
  duration_minutes?: number | null;
  id?: string;
  intensity?: ActivityIntensity | null;
  updated_at?: string;
  user_id: string;
};

export type WeightLogRow = {
  created_at: string;
  id: string;
  recorded_at: string;
  updated_at: string;
  user_id: string;
  weight_kg: number;
};

type WeightLogInsert = {
  created_at?: string;
  id?: string;
  recorded_at?: string;
  updated_at?: string;
  user_id: string;
  weight_kg: number;
};

export type NutritionTargetSnapshotRow = {
  baseline_calories: number | null;
  base_calories: number;
  calculation_version: string;
  calorie_adjustment_calories: number;
  calories: number;
  carbohydrate_grams: number;
  created_at: string;
  fat_grams: number;
  id: string;
  goal_adjustment_calories: number | null;
  planned_training_calories: number | null;
  protein_grams: number;
  resting_calories: number | null;
  target_date: string;
  updated_at: string;
  user_id: string;
};

type NutritionTargetSnapshotInsert = {
  baseline_calories?: number | null;
  base_calories: number;
  calculation_version: string;
  calorie_adjustment_calories?: number;
  calories: number;
  carbohydrate_grams: number;
  created_at?: string;
  fat_grams: number;
  id?: string;
  goal_adjustment_calories?: number | null;
  planned_training_calories?: number | null;
  protein_grams: number;
  resting_calories?: number | null;
  target_date: string;
  updated_at?: string;
  user_id: string;
};

export type AiDailyAnalysisRow = {
  accepted_at: string | null;
  analysis_date: string;
  analysis_time_zone: string;
  attempt_count: number;
  category: AiAnalysisCategory | null;
  completed_at: string | null;
  confidence: AiAnalysisConfidence | null;
  context_version: string | null;
  created_at: string;
  dismissed_at: string | null;
  error_code: string | null;
  evidence: Json;
  first_shown_at: string | null;
  id: string;
  message: string | null;
  model: string | null;
  outcome_reason: AiAnalysisOutcomeReason | null;
  priority: AiAnalysisPriority | null;
  processing_started_at: string;
  processing_token: string;
  proposed_action: Json | null;
  provider_response_id: string | null;
  retry_after: string | null;
  status: AiAnalysisStatus;
  title: string | null;
  updated_at: string;
  user_id: string;
};

type AiDailyAnalysisInsert = {
  accepted_at?: string | null;
  analysis_date: string;
  analysis_time_zone: string;
  attempt_count?: number;
  category?: AiAnalysisCategory | null;
  completed_at?: string | null;
  confidence?: AiAnalysisConfidence | null;
  context_version?: string | null;
  created_at?: string;
  dismissed_at?: string | null;
  error_code?: string | null;
  evidence?: Json;
  first_shown_at?: string | null;
  id?: string;
  message?: string | null;
  model?: string | null;
  outcome_reason?: AiAnalysisOutcomeReason | null;
  priority?: AiAnalysisPriority | null;
  processing_started_at?: string;
  processing_token?: string;
  proposed_action?: Json | null;
  provider_response_id?: string | null;
  retry_after?: string | null;
  status?: AiAnalysisStatus;
  title?: string | null;
  updated_at?: string;
  user_id: string;
};

type Table<Row, Insert, Update = Partial<Insert>> = {
  Insert: Insert;
  Relationships: [];
  Row: Row;
  Update: Update;
};

export type Database = {
  public: {
    CompositeTypes: { [_ in never]: never };
    Enums: {
      activity_intensity: ActivityIntensity;
      activity_level: ActivityLevel;
      ai_analysis_category: AiAnalysisCategory;
      ai_analysis_confidence: AiAnalysisConfidence;
      ai_analysis_outcome_reason: AiAnalysisOutcomeReason;
      ai_analysis_priority: AiAnalysisPriority;
      ai_analysis_status: AiAnalysisStatus;
      app_locale: AppLocale;
      equipment_category: EquipmentCategory;
      fitness_goal: FitnessGoal;
      muscle_group: MuscleGroup;
      profile_sex: ProfileSex;
      schedule_item_type: ScheduleItemType;
      weight_unit: WeightUnit;
    };
    Functions: {
      accept_ai_daily_analysis: {
        Args: { analysis_id_value: string };
        Returns: AiDailyAnalysisRow;
      };
      claim_ai_daily_analysis: {
        Args: {
          analysis_user_id: string;
          requested_analysis_date: string;
          requested_time_zone: string;
        };
        Returns: {
          analysis_id: string;
          analysis_status: AiAnalysisStatus;
          processing_token: string;
          should_process: boolean;
        }[];
      };
      claim_ai_daily_analysis_for_display: {
        Args: { analysis_id_value: string };
        Returns: AiDailyAnalysisRow | null;
      };
      complete_ai_daily_analysis: {
        Args: {
          analysis_id_value: string;
          processing_token_value: string;
          result_category: AiAnalysisCategory;
          result_confidence: AiAnalysisConfidence;
          result_context_version: string;
          result_evidence: Json;
          result_message: string | null;
          result_model: string | null;
          result_outcome_reason: AiAnalysisOutcomeReason;
          result_priority: AiAnalysisPriority;
          result_proposed_action: Json;
          result_provider_response_id: string | null;
          result_status: AiAnalysisStatus;
          result_title: string | null;
        };
        Returns: AiDailyAnalysisRow;
      };
      complete_onboarding: {
        Args: {
          birth_date: string;
          body_height_cm: number;
          initial_weight_kg: number;
          preferred_locale: AppLocale;
          preferred_unit: WeightUnit;
          profile_activity_level: ActivityLevel;
          profile_goal: FitnessGoal;
          profile_sex_value: ProfileSex;
        };
        Returns: ProfileRow;
      };
      delete_daily_schedule_override: {
        Args: {
          override_date: string;
        };
        Returns: undefined;
      };
      dismiss_ai_daily_analysis: {
        Args: { analysis_id_value: string };
        Returns: AiDailyAnalysisRow;
      };
      fail_ai_daily_analysis: {
        Args: {
          analysis_id_value: string;
          failure_code: string;
          processing_token_value: string;
          retry_delay?: string;
        };
        Returns: AiDailyAnalysisRow;
      };
      delete_workout_set: {
        Args: {
          workout_set_id_value: string;
        };
        Returns: undefined;
      };
      delete_custom_exercise: {
        Args: {
          exercise_id_value: string;
        };
        Returns: undefined;
      };
      replace_daily_schedule_override: {
        Args: {
          override_date: string;
          schedule_items: Json;
        };
        Returns: string;
      };
      finish_workout_session: {
        Args: {
          workout_session_id_value: string;
        };
        Returns: WorkoutSessionRow;
      };
      get_previous_exercise_performance: {
        Args: {
          before_started_at_value: string;
          exercise_ids: string[];
        };
        Returns: PreviousExercisePerformanceRow[];
      };
      replace_weekly_schedule_day: {
        Args: {
          schedule_items: Json;
          schedule_weekday: number;
        };
        Returns: WeeklyScheduleItemRow[];
      };
      save_workout_plan: {
        Args: {
          ordered_exercise_ids: string[];
          workout_plan_id_value: string | null;
          workout_plan_name: string;
        };
        Returns: WorkoutPlanRow;
      };
      save_workout_set: {
        Args: {
          completed_value: boolean;
          reps_value: number;
          session_exercise_id_value: string;
          weight_kg_value: number;
          workout_set_id_value: string | null;
        };
        Returns: WorkoutSetRow;
      };
      start_workout_session: {
        Args: {
          session_date_value: string;
          workout_plan_id_value: string;
        };
        Returns: string;
      };
    };
    Tables: {
      ai_daily_analyses: Table<
        AiDailyAnalysisRow,
        AiDailyAnalysisInsert,
        Partial<AiDailyAnalysisInsert>
      >;
      activity_definitions: Table<
        ActivityDefinitionRow,
        ActivityDefinitionInsert,
        Partial<ActivityDefinitionInsert>
      >;
      activity_logs: Table<ActivityLogRow, ActivityLogInsert, Partial<ActivityLogInsert>>;
      daily_schedule_override_items: Table<
        DailyScheduleOverrideItemRow,
        DailyScheduleOverrideItemInsert,
        Partial<DailyScheduleOverrideItemInsert>
      >;
      daily_schedule_overrides: Table<
        DailyScheduleOverrideRow,
        DailyScheduleOverrideInsert,
        Partial<DailyScheduleOverrideInsert>
      >;
      exercises: Table<ExerciseRow, ExerciseInsert, Partial<ExerciseInsert>>;
      nutrition_target_snapshots: Table<
        NutritionTargetSnapshotRow,
        NutritionTargetSnapshotInsert,
        Partial<NutritionTargetSnapshotInsert>
      >;
      profiles: Table<ProfileRow, ProfileInsert, ProfileUpdate>;
      weekly_schedule_items: Table<
        WeeklyScheduleItemRow,
        WeeklyScheduleItemInsert,
        Partial<WeeklyScheduleItemInsert>
      >;
      weight_logs: Table<WeightLogRow, WeightLogInsert, Partial<WeightLogInsert>>;
      workout_plan_exercises: Table<
        WorkoutPlanExerciseRow,
        WorkoutPlanExerciseInsert,
        Partial<WorkoutPlanExerciseInsert>
      >;
      workout_plans: Table<WorkoutPlanRow, WorkoutPlanInsert, Partial<WorkoutPlanInsert>>;
      workout_session_exercises: Table<
        WorkoutSessionExerciseRow,
        WorkoutSessionExerciseInsert,
        Partial<WorkoutSessionExerciseInsert>
      >;
      workout_sessions: Table<
        WorkoutSessionRow,
        WorkoutSessionInsert,
        Partial<WorkoutSessionInsert>
      >;
      workout_sets: Table<WorkoutSetRow, WorkoutSetInsert, Partial<WorkoutSetInsert>>;
    };
    Views: { [_ in never]: never };
  };
};
