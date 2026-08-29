import type {
  ActivityDefinitionRow,
  AppLocale,
  EquipmentCategory,
  ExerciseRow,
  MuscleGroup,
  ScheduleItemType,
  WorkoutPlanRow,
} from '@/types/database';

export type TrainingLocale = AppLocale;

export type Exercise = ExerciseRow & {
  displayName: string;
};

export type ActivityDefinition = ActivityDefinitionRow & {
  displayName: string;
};

export type WorkoutPlanExercise = {
  exercise: Exercise;
  id: string;
  position: number;
};

export type WorkoutPlan = WorkoutPlanRow & {
  exercises: WorkoutPlanExercise[];
};

export type ScheduleDraftItem = {
  itemType: ScheduleItemType;
  referenceId: string | null;
};

export type WeeklyScheduleItem = ScheduleDraftItem & {
  id: string;
  position: number;
  weekday: number;
};

export type DailyScheduleOverride = {
  date: string;
  id: string;
  items: ScheduleDraftItem[];
};

export type TrainingData = {
  activities: ActivityDefinition[];
  exercises: Exercise[];
  plans: WorkoutPlan[];
  weeklySchedule: WeeklyScheduleItem[];
};

export type CreateCustomExerciseInput = {
  equipment: EquipmentCategory;
  muscleGroup: MuscleGroup;
  name: string;
  userId: string;
};

export type SaveWorkoutPlanInput = {
  exerciseIds: string[];
  name: string;
  planId: string | null;
};
