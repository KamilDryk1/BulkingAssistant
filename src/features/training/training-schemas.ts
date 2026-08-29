import { z } from 'zod';

const exerciseName = z
  .string()
  .trim()
  .min(1, 'validation.exerciseNameRequired')
  .max(80, 'validation.nameTooLong');
const planName = z
  .string()
  .trim()
  .min(1, 'validation.planNameRequired')
  .max(80, 'validation.nameTooLong');

export const customExerciseSchema = z.object({
  equipment: z.enum(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other']),
  muscleGroup: z.enum(['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'core']),
  name: exerciseName,
});

export const workoutPlanSchema = z.object({
  name: planName,
});

export type CustomExerciseFormValues = z.infer<typeof customExerciseSchema>;
export type WorkoutPlanFormValues = z.infer<typeof workoutPlanSchema>;
