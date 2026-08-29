import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { CompactAction } from '@/components/compact-action';
import { FormTextField } from '@/components/form-text-field';
import { QueryStateCard } from '@/components/query-state-card';
import { useAuth } from '@/features/auth/auth-context';
import { useDeleteCustomExercise, useTrainingData } from '@/features/training/training-queries';
import type { Exercise } from '@/features/training/training-types';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, spacing } from '@/theme';
import type { MuscleGroup } from '@/types/database';

const muscleGroups: MuscleGroup[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core',
];

type ExerciseSection = {
  data: Exercise[];
  key: string;
  title: string;
};

export function ExerciseLibraryScreen() {
  const { t } = useTranslation('training');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const training = useTrainingData(user?.id ?? '', profile?.locale ?? getCurrentLocale());
  const deleteExercise = useDeleteCustomExercise();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase();

  const sections = useMemo<ExerciseSection[]>(() => {
    const visibleExercises = (training.data?.exercises ?? []).filter((exercise) => {
      const searchable =
        `${exercise.displayName} ${t(`muscleGroups.${exercise.muscle_group}`)} ${t(`equipment.${exercise.equipment}`)}`.toLocaleLowerCase();
      return !normalizedSearch || searchable.includes(normalizedSearch);
    });
    const result: ExerciseSection[] = [];
    const custom = visibleExercises.filter((exercise) => exercise.is_custom);

    if (custom.length > 0) {
      result.push({ data: custom, key: 'custom', title: t('exercisesScreen.custom') });
    }

    muscleGroups.forEach((muscleGroup) => {
      const data = visibleExercises.filter(
        (exercise) => !exercise.is_custom && exercise.muscle_group === muscleGroup,
      );
      if (data.length > 0) {
        result.push({
          data,
          key: muscleGroup,
          title: t(`muscleGroups.${muscleGroup}`),
        });
      }
    });

    return result;
  }, [normalizedSearch, t, training.data?.exercises]);

  const confirmDelete = (exerciseId: string) => {
    Alert.alert(t('exercisesScreen.deleteTitle'), t('exercisesScreen.deleteDetail'), [
      { style: 'cancel', text: t('actions.cancel') },
      {
        onPress: () => deleteExercise.mutate(exerciseId),
        style: 'destructive',
        text: t('actions.delete'),
      },
    ]);
  };

  if (training.isPending || training.isError) {
    return (
      <View style={{ backgroundColor: colors.background, flex: 1, padding: layout.screenPadding }}>
        <QueryStateCard
          actionLabel={training.isError ? t('status.retry') : undefined}
          detail={training.isError ? t('status.errorDetail') : t('status.loadingDetail')}
          onAction={training.isError ? () => void training.refetch() : undefined}
          title={training.isError ? t('status.errorTitle') : t('status.loadingTitle')}
        />
      </View>
    );
  }

  return (
    <SectionList
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(exercise) => exercise.id}
      ListEmptyComponent={
        <QueryStateCard
          detail={t('exercisesScreen.emptyDetail')}
          title={t('exercisesScreen.emptyTitle')}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing.lg, paddingBottom: spacing.xxl }}>
          <AppText color="textSecondary">{t('exercisesScreen.intro')}</AppText>
          <AppButton
            onPress={() => router.push('/training-tools/exercises/new')}
            title={t('exercisesScreen.create')}
          />
          <FormTextField
            label={t('exercisesScreen.search')}
            onChangeText={setSearch}
            value={search}
          />
          {deleteExercise.isError ? (
            <AppText color="danger" variant="caption">
              {t('exercisesScreen.deleteError')}
            </AppText>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Card style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
              <AppText style={{ flexShrink: 1 }} variant="bodyStrong">
                {item.displayName}
              </AppText>
              {item.is_custom ? (
                <AppText color="primary" variant="label">
                  {t('exercisesScreen.customBadge')}
                </AppText>
              ) : null}
            </View>
            <AppText color="textMuted" variant="caption">
              {t(`muscleGroups.${item.muscle_group}`)} · {t(`equipment.${item.equipment}`)}
            </AppText>
          </View>
          {item.is_custom ? (
            <CompactAction
              accessibilityLabel={t('actions.delete')}
              disabled={deleteExercise.isPending}
              label="×"
              onPress={() => confirmDelete(item.id)}
            />
          ) : null}
        </Card>
      )}
      renderSectionHeader={({ section }) => (
        <View
          style={{
            backgroundColor: colors.background,
            paddingBottom: spacing.sm,
            paddingTop: spacing.lg,
          }}
        >
          <AppText variant="label">{section.title}</AppText>
        </View>
      )}
      sections={sections}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled
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
  );
}
