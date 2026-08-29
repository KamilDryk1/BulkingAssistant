import { getSupabaseClient } from '@/services/supabase/get-client';
import type {
  ActivityLevel,
  AppLocale,
  FitnessGoal,
  ProfileRow,
  ProfileSex,
  WeightUnit,
} from '@/types/database';

export type CompleteOnboardingInput = {
  activityLevel: ActivityLevel;
  dateOfBirth: string;
  goal: FitnessGoal;
  heightCm: number;
  initialWeightKg: number;
  locale: AppLocale;
  sex: ProfileSex;
  weightUnit: WeightUnit;
};

export type UpdateProfileInput = Partial<
  Pick<
    ProfileRow,
    | 'activity_level'
    | 'date_of_birth'
    | 'goal'
    | 'height_cm'
    | 'locale'
    | 'preferred_weight_unit'
    | 'sex'
  >
>;

export async function fetchProfile(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function completeOnboarding(input: CompleteOnboardingInput) {
  const { data, error } = await getSupabaseClient().rpc('complete_onboarding', {
    birth_date: input.dateOfBirth,
    body_height_cm: input.heightCm,
    initial_weight_kg: input.initialWeightKg,
    preferred_locale: input.locale,
    preferred_unit: input.weightUnit,
    profile_activity_level: input.activityLevel,
    profile_goal: input.goal,
    profile_sex_value: input.sex,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update(input)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}
