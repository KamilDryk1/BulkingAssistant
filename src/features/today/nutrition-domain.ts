import type { ActivityIntensity, ActivityLevel, FitnessGoal, ProfileSex } from '@/types/database';

export const nutritionCalculationVersion = 'mifflin-st-jeor-plan-aware-v2';

const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

const goalCalorieAdjustments: Record<FitnessGoal, number> = {
  cut: -400,
  gain: 250,
  maintain: 0,
};

const proteinGramsPerKilogram: Record<FitnessGoal, number> = {
  cut: 2,
  gain: 1.8,
  maintain: 1.8,
};

const fatCaloriesRatio = 0.25;
const caloriesPerProteinGram = 4;
const caloriesPerCarbohydrateGram = 4;
const caloriesPerFatGram = 9;
const minimumCalories: Record<ProfileSex, number> = {
  female: 1200,
  male: 1500,
};

export const strengthTrainingMetByIntensity: Record<ActivityIntensity, number> = {
  hard: 6,
  light: 3.5,
  moderate: 5,
};

export type PlannedTrainingSession = {
  durationMinutes: number;
  met: number;
};

export type NutritionCalculationInput = {
  activityLevel: ActivityLevel;
  calorieAdjustmentCalories?: number;
  dateOfBirth: string;
  goal: FitnessGoal;
  heightCm: number;
  plannedSessions?: readonly PlannedTrainingSession[];
  sex: ProfileSex;
  targetDate: string;
  weightKg: number;
};

export function calculateAge(dateOfBirth: string, targetDate: string) {
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number);
  const [targetYear, targetMonth, targetDay] = targetDate.split('-').map(Number);
  const birthdayPassed =
    targetMonth > birthMonth || (targetMonth === birthMonth && targetDay >= birthDay);

  return targetYear - birthYear - (birthdayPassed ? 0 : 1);
}

export function calculatePlannedSessionNetCalories(
  session: PlannedTrainingSession,
  restingCalories: number,
  weightKg: number,
) {
  const grossCalories = (session.met * 3.5 * weightKg * session.durationMinutes) / 200;
  const restingCaloriesDuringSession = (restingCalories / 1440) * session.durationMinutes;

  return Math.max(0, grossCalories - restingCaloriesDuringSession);
}

export function calculateNutritionTarget(input: NutritionCalculationInput) {
  const age = calculateAge(input.dateOfBirth, input.targetDate);
  const sexAdjustment = input.sex === 'male' ? 5 : -161;
  const restingCalories = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age + sexAdjustment;
  const baselineCalories = restingCalories * activityFactors[input.activityLevel];
  const weeklyPlannedTrainingCalories = (input.plannedSessions ?? []).reduce(
    (total, session) =>
      total + calculatePlannedSessionNetCalories(session, restingCalories, input.weightKg),
    0,
  );
  const plannedTrainingCalories = weeklyPlannedTrainingCalories / 7;
  const maintenanceCalories = baselineCalories + plannedTrainingCalories;
  const goalAdjustmentCalories = goalCalorieAdjustments[input.goal];
  const baseCalories = Math.max(
    minimumCalories[input.sex],
    Math.round((maintenanceCalories + goalAdjustmentCalories) / 10) * 10,
  );
  const calorieAdjustmentCalories = input.calorieAdjustmentCalories ?? 0;
  const calories = baseCalories + calorieAdjustmentCalories;
  const proteinGrams = Math.round(input.weightKg * proteinGramsPerKilogram[input.goal]);
  const fatGrams = Math.round((calories * fatCaloriesRatio) / caloriesPerFatGram);
  const carbohydrateGrams = Math.max(
    0,
    Math.round(
      (calories - proteinGrams * caloriesPerProteinGram - fatGrams * caloriesPerFatGram) /
        caloriesPerCarbohydrateGram,
    ),
  );

  return {
    baselineCalories: Math.round(baselineCalories),
    baseCalories,
    calorieAdjustmentCalories,
    calories,
    carbohydrateGrams,
    fatGrams,
    goalAdjustmentCalories,
    maintenanceCalories: Math.round(maintenanceCalories),
    plannedTrainingCalories: Math.round(plannedTrainingCalories),
    proteinGrams,
    restingCalories: Math.round(restingCalories),
    weeklyPlannedTrainingCalories: Math.round(weeklyPlannedTrainingCalories),
  };
}
