import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { ChoiceField } from '@/components/choice-field';
import { FormTextField } from '@/components/form-text-field';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { useCreateCustomExercise } from '@/features/training/training-queries';
import {
  customExerciseSchema,
  type CustomExerciseFormValues,
} from '@/features/training/training-schemas';
import { spacing } from '@/theme';
import type { EquipmentCategory, MuscleGroup } from '@/types/database';

const muscleGroups: MuscleGroup[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core',
];
const equipment: EquipmentCategory[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'other',
];

type CustomExerciseScreenProps = {
  initialName?: string;
  onCreated: (exerciseId: string) => void;
};

export function CustomExerciseScreen({ initialName = '', onCreated }: CustomExerciseScreenProps) {
  const { t } = useTranslation('training');
  const { user } = useAuth();
  const createExercise = useCreateCustomExercise();
  const form = useForm<CustomExerciseFormValues>({
    defaultValues: {
      equipment: 'barbell',
      muscleGroup: 'chest',
      name: initialName.trim(),
    },
    resolver: zodResolver(customExerciseSchema),
  });
  const submit = form.handleSubmit((values) => {
    if (!user) {
      return;
    }

    createExercise.mutate(
      { ...values, userId: user.id },
      { onSuccess: (exercise) => onCreated(exercise.id) },
    );
  });

  return (
    <StackScrollScreen>
      <AppText color="textSecondary">{t('exerciseForm.intro')}</AppText>
      <Card elevated style={{ gap: spacing.xl }}>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <FormTextField
              error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              label={t('exerciseForm.name')}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder={t('exerciseForm.namePlaceholder')}
              value={field.value}
            />
          )}
        />
        <Controller
          control={form.control}
          name="muscleGroup"
          render={({ field, fieldState }) => (
            <ChoiceField
              error={fieldState.error?.message}
              label={t('exerciseForm.muscleGroup')}
              onChange={field.onChange}
              options={muscleGroups.map((value) => ({
                label: t(`muscleGroups.${value}`),
                value,
              }))}
              value={field.value}
            />
          )}
        />
        <Controller
          control={form.control}
          name="equipment"
          render={({ field, fieldState }) => (
            <ChoiceField
              error={fieldState.error?.message}
              label={t('exerciseForm.equipment')}
              onChange={field.onChange}
              options={equipment.map((value) => ({
                label: t(`equipment.${value}`),
                value,
              }))}
              value={field.value}
            />
          )}
        />
        {createExercise.isError ? (
          <AppText color="danger" variant="caption">
            {t('exerciseForm.error')}
          </AppText>
        ) : null}
        <AppButton
          loading={createExercise.isPending}
          onPress={submit}
          title={t('exerciseForm.save')}
        />
      </Card>
    </StackScrollScreen>
  );
}
