import type { ActivityLevel, FitnessGoal, ProfileSex } from '@/types/database';

export const nutritionCalculationVersion = 'mifflin-st-jeor-v1';

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

export type NutritionCalculationInput = {
  activityLevel: ActivityLevel;
  dateOfBirth: string;
  goal: FitnessGoal;
  heightCm: number;
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

export function calculateNutritionTarget(input: NutritionCalculationInput) {
  const age = calculateAge(input.dateOfBirth, input.targetDate);
  const sexAdjustment = input.sex === 'male' ? 5 : -161;
  const restingCalories = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age + sexAdjustment;
  const baselineCalories = restingCalories * activityFactors[input.activityLevel];
  const calories = Math.max(
    minimumCalories[input.sex],
    Math.round((baselineCalories + goalCalorieAdjustments[input.goal]) / 10) * 10,
  );
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
    calories,
    carbohydrateGrams,
    fatGrams,
    proteinGrams,
    restingCalories: Math.round(restingCalories),
  };
}
