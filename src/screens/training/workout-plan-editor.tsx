import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { CompactAction } from '@/components/compact-action';
import { FormTextField } from '@/components/form-text-field';
import { QueryStateCard } from '@/components/query-state-card';
import { SectionLabel } from '@/components/section-label';
import { useAuth } from '@/features/auth/auth-context';
import { moveItem } from '@/features/training/training-domain';
import { useSaveWorkoutPlan, useTrainingData } from '@/features/training/training-queries';
import {
  workoutPlanSchema,
  type WorkoutPlanFormValues,
} from '@/features/training/training-schemas';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, opacity, spacing } from '@/theme';

type WorkoutPlanEditorScreenProps = {
  planId: string | null;
};

export function WorkoutPlanEditorScreen({ planId }: WorkoutPlanEditorScreenProps) {
  const { t } = useTranslation('training');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const training = useTrainingData(user?.id ?? '', profile?.locale ?? getCurrentLocale());
  const savePlan = useSaveWorkoutPlan();
  const plan = planId ? training.data?.plans.find((item) => item.id === planId) : null;
  const [selectedExerciseIdsOverride, setSelectedExerciseIds] = useState<string[] | null>(null);
  const [search, setSearch] = useState('');
  const form = useForm<WorkoutPlanFormValues>({
    defaultValues: { name: '' },
    resolver: zodResolver(workoutPlanSchema),
    values: { name: plan?.name ?? '' },
  });
  const selectedExerciseIds =
    selectedExerciseIdsOverride ?? plan?.exercises.map((item) => item.exercise.id) ?? [];

  const exercisesById = useMemo(
    () => new Map(training.data?.exercises.map((exercise) => [exercise.id, exercise]) ?? []),
    [training.data?.exercises],
  );
  const selectedExercises = selectedExerciseIds.flatMap((exerciseId) => {
    const exercise = exercisesById.get(exerciseId);
    return exercise ? [exercise] : [];
  });
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const availableExercises = (training.data?.exercises ?? []).filter((exercise) => {
    if (selectedExerciseIds.includes(exercise.id)) {
      return false;
    }

    const searchable =
      `${exercise.displayName} ${t(`muscleGroups.${exercise.muscle_group}`)} ${t(`equipment.${exercise.equipment}`)}`.toLocaleLowerCase();
    return !normalizedSearch || searchable.includes(normalizedSearch);
  });

  const submit = form.handleSubmit((values) => {
    savePlan.mutate(
      {
        exerciseIds: selectedExerciseIds,
        name: values.name,
        planId,
      },
      { onSuccess: () => router.back() },
    );
  });

  if (training.isPending) {
    return (
      <View style={{ backgroundColor: colors.background, flex: 1, padding: layout.screenPadding }}>
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      </View>
    );
  }

  if (training.isError) {
    return (
      <View style={{ backgroundColor: colors.background, flex: 1, padding: layout.screenPadding }}>
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={() => void training.refetch()}
          title={t('status.errorTitle')}
        />
      </View>
    );
  }

  if (planId && !plan) {
    return (
      <View style={{ backgroundColor: colors.background, flex: 1, padding: layout.screenPadding }}>
        <QueryStateCard
          actionLabel={t('planEditor.goBack')}
          detail={t('planEditor.notFoundDetail')}
          onAction={() => router.back()}
          title={t('planEditor.notFoundTitle')}
        />
      </View>
    );
  }

  const header = (
    <View style={{ gap: spacing.xxl }}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('planEditor.details')} />
        <Card elevated style={{ gap: spacing.lg }}>
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <FormTextField
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                label={t('planEditor.name')}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder={t('planEditor.namePlaceholder')}
                returnKeyType="done"
                value={field.value}
              />
            )}
          />
          {savePlan.isError ? (
            <AppText color="danger" variant="caption">
              {t('planEditor.saveError')}
            </AppText>
          ) : null}
          <AppButton
            loading={savePlan.isPending}
            onPress={submit}
            title={planId ? t('planEditor.saveUpdate') : t('planEditor.saveCreate')}
          />
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('planEditor.selected')} />
        {selectedExercises.length === 0 ? (
          <Card>
            <AppText color="textMuted">{t('planEditor.selectedEmpty')}</AppText>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {selectedExercises.map((exercise, index) => (
              <Card
                key={exercise.id}
                style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}
              >
                <AppText color="primary" variant="bodyStrong">
                  {index + 1}
                </AppText>
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <AppText variant="bodyStrong">{exercise.displayName}</AppText>
                  <AppText color="textMuted" variant="caption">
                    {t(`muscleGroups.${exercise.muscle_group}`)} ·{' '}
                    {t(`equipment.${exercise.equipment}`)}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <CompactAction
                    accessibilityLabel={t('actions.moveUp')}
                    disabled={index === 0}
                    label="↑"
                    onPress={() =>
                      setSelectedExerciseIds(moveItem(selectedExerciseIds, index, index - 1))
                    }
                  />
                  <CompactAction
                    accessibilityLabel={t('actions.moveDown')}
                    disabled={index === selectedExercises.length - 1}
                    label="↓"
                    onPress={() =>
                      setSelectedExerciseIds(moveItem(selectedExerciseIds, index, index + 1))
                    }
                  />
                  <CompactAction
                    accessibilityLabel={t('actions.remove')}
                    label="×"
                    onPress={() =>
                      setSelectedExerciseIds(
                        selectedExerciseIds.filter((exerciseId) => exerciseId !== exercise.id),
                      )
                    }
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('planEditor.available')} />
        <FormTextField label={t('planEditor.search')} onChangeText={setSearch} value={search} />
      </View>
    </View>
  );

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <FlatList
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        data={availableExercises}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(exercise) => exercise.id}
        ListEmptyComponent={
          <Card>
            <AppText color="textMuted">{t('planEditor.noResults')}</AppText>
          </Card>
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedExerciseIds([...selectedExerciseIds, item.id])}
            style={({ pressed }) => ({ opacity: pressed ? opacity.pressed : 1 })}
          >
            <Card style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <AppText variant="bodyStrong">{item.displayName}</AppText>
                <AppText color="textMuted" variant="caption">
                  {t(`muscleGroups.${item.muscle_group}`)} · {t(`equipment.${item.equipment}`)}
                </AppText>
              </View>
              <AppText accessibilityElementsHidden color="primary" importantForAccessibility="no">
                +
              </AppText>
            </Card>
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignSelf: 'center',
          gap: spacing.sm,
          maxWidth: layout.maxContentWidth,
          paddingBottom: insets.bottom + spacing.huge,
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          width: '100%',
        }}
      />
    </View>
  );
}
