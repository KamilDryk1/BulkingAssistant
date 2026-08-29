import type {
  ActivityIntensity,
  ActivityLogRow,
  NutritionTargetSnapshotRow,
  WeightLogRow,
  WorkoutSessionRow,
} from '@/types/database';

export type TodayData = {
  activities: ActivityLogRow[];
  completedWorkouts: WorkoutSessionRow[];
  latestWeight: WeightLogRow | null;
  nutritionTarget: NutritionTargetSnapshotRow | null;
  sevenDayAverageKg: number | null;
  todayWeight: WeightLogRow | null;
};

export type SaveActivityLogInput = {
  activityDate: string;
  activityDefinitionId: string;
  activityName: string;
  durationMinutes: number | null;
  intensity: ActivityIntensity | null;
  userId: string;
};

export type SaveTodayWeightInput = {
  existingLogId: string | null;
  userId: string;
  weightKg: number;
};
