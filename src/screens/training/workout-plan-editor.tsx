import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { type FlatList, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AutoScrollProvider, useAutoScrollContainer } from '@/components/auto-scroll-context';
import { Card } from '@/components/card';
import { CompactAction } from '@/components/compact-action';
import { FormTextField } from '@/components/form-text-field';
import { QueryStateCard } from '@/components/query-state-card';
import { ReorderableList } from '@/components/reorderable-list';
import { SectionLabel } from '@/components/section-label';
import { useAuth } from '@/features/auth/auth-context';
import { addUniqueItem, moveItem } from '@/features/training/training-domain';
import { useSaveWorkoutPlan, useTrainingData } from '@/features/training/training-queries';
import {
  workoutPlanSchema,
  type WorkoutPlanFormValues,
} from '@/features/training/training-schemas';
import type { Exercise } from '@/features/training/training-types';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, opacity, spacing } from '@/theme';

type WorkoutPlanEditorScreenProps = {
  addedExerciseId?: string;
  planId: string | null;
};

export function WorkoutPlanEditorScreen({ addedExerciseId, planId }: WorkoutPlanEditorScreenProps) {
  const { t } = useTranslation('training');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    animatedRef,
    onContentSizeChange,
    onLayout,
    onScroll,
    value: autoScrollValue,
  } = useAutoScrollContainer<FlatList<Exercise>>();
  const { profile, user } = useAuth();
  const training = useTrainingData(user?.id ?? '', profile?.locale ?? getCurrentLocale());
  const savePlan = useSaveWorkoutPlan();
  const plan = planId ? training.data?.plans.find((item) => item.id === planId) : null;
  const [selectedExerciseIdsOverride, setSelectedExerciseIds] = useState<string[] | null>(null);
  const [search, setSearch] = useState('');
  const handledAddedExerciseId = useRef<string | null>(null);
  const form = useForm<WorkoutPlanFormValues>({
    defaultValues: { name: '' },
    resolver: zodResolver(workoutPlanSchema),
    values: { name: plan?.name ?? '' },
  });
  const selectedExerciseIds =
    selectedExerciseIdsOverride ?? plan?.exercises.map((item) => item.exercise.id) ?? [];

  useEffect(() => {
    if (!addedExerciseId || handledAddedExerciseId.current === addedExerciseId) {
      return;
    }

    handledAddedExerciseId.current = addedExerciseId;
    setSelectedExerciseIds((currentIds) => {
      const baseIds = currentIds ?? plan?.exercises.map((item) => item.exercise.id) ?? [];
      return addUniqueItem(baseIds, addedExerciseId);
    });
    setSearch('');
  }, [addedExerciseId, plan?.exercises]);

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
            {selectedExercises.length > 1 ? (
              <AppText color="textMuted" variant="caption">
                {t('actions.reorderHint')}
              </AppText>
            ) : null}
            <ReorderableList
              itemKeys={selectedExercises.map((exercise) => exercise.id)}
              onMove={(fromIndex, toIndex) =>
                setSelectedExerciseIds(moveItem(selectedExerciseIds, fromIndex, toIndex))
              }
              renderItem={(exerciseId, index) => {
                const exercise = exercisesById.get(exerciseId);

                return exercise ? (
                  <Card style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
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
                            selectedExerciseIds.filter(
                              (selectedExerciseId) => selectedExerciseId !== exercise.id,
                            ),
                          )
                        }
                      />
                    </View>
                  </Card>
                ) : null;
              }}
            />
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
      <AutoScrollProvider value={autoScrollValue}>
        <Animated.FlatList<Exercise>
          ref={animatedRef}
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
          ListFooterComponent={
            <View style={{ paddingTop: spacing.sm }}>
              <AppButton
                onPress={() =>
                  router.push({
                    pathname: '/training-tools/exercises/new',
                    params: {
                      addToPlan: planId ?? 'new',
                      initialName: search.trim(),
                    },
                  })
                }
                title={t('planEditor.createExercise')}
                variant="secondary"
              />
            </View>
          }
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayout}
          onScroll={onScroll}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedExerciseIds(addUniqueItem(selectedExerciseIds, item.id))}
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
          scrollEventThrottle={16}
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
      </AutoScrollProvider>
    </View>
  );
}
