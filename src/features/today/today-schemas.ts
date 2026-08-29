import { z } from 'zod';

export const activityLogSchema = z.object({
  activityId: z.string().min(1, 'validation.activityRequired'),
  durationMinutes: z.string().refine((value) => {
    if (value.trim() === '') {
      return true;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 1440;
  }, 'validation.durationInvalid'),
  intensity: z.enum(['', 'light', 'moderate', 'hard']),
});

export type ActivityLogValues = z.infer<typeof activityLogSchema>;

export const weightLogSchema = z.object({
  weight: z.string().refine((value) => {
    const normalized = Number(value.trim().replace(',', '.'));
    return Number.isFinite(normalized) && normalized > 0;
  }, 'validation.weightInvalid'),
});

export type WeightLogValues = z.infer<typeof weightLogSchema>;
