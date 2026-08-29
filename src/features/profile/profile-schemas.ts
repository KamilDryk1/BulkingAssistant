import { z } from 'zod';

import { normalizeDecimalInput, poundsToKilograms } from '@/features/units/weight';

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const personalDetailsSchema = z.object({
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'very_active', 'extremely_active']),
  dateOfBirth: z
    .string()
    .trim()
    .refine((value) => isValidDate(value) && value <= new Date().toISOString().slice(0, 10), {
      message: 'validation.date',
    }),
  goal: z.enum(['cut', 'maintain', 'gain']),
  heightCm: z.string().refine((value) => {
    const height = normalizeDecimalInput(value);
    return Number.isFinite(height) && height >= 80 && height <= 260;
  }, 'validation.height'),
  sex: z.enum(['male', 'female']),
});

export const onboardingSchema = personalDetailsSchema
  .extend({
    initialWeight: z.string().min(1, 'validation.required'),
    locale: z.enum(['en', 'pl']),
    weightUnit: z.enum(['kg', 'lb']),
  })
  .superRefine((value, context) => {
    const enteredWeight = normalizeDecimalInput(value.initialWeight);
    const weightKg = value.weightUnit === 'lb' ? poundsToKilograms(enteredWeight) : enteredWeight;

    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) {
      context.addIssue({
        code: 'custom',
        message: 'validation.weight',
        path: ['initialWeight'],
      });
    }
  });

export const profileSchema = personalDetailsSchema;

export type OnboardingValues = z.infer<typeof onboardingSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
