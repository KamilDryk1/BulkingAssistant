import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { getInitialExerciseIndex } from '@/features/workout/workout-domain';
import { PreviousPerformanceCard } from '@/features/workout/previous-performance-card';
import {
  useDeleteWorkoutSet,
  useFinishWorkoutSession,
  useSaveWorkoutSet,
  useWorkoutSessionDetails,
} from '@/features/workout/workout-queries';
import { SetEntryCard } from '@/features/workout/set-entry-card';
import { useWorkoutElapsedTime } from '@/features/workout/use-workout-elapsed-time';
import type { SaveWorkoutSetInput, WorkoutSessionDetails } from '@/features/workout/workout-types';
import { colors, layout, radius, spacing } from '@/theme';

type ActiveWorkoutScreenProps = {
  sessionId: string;
};

export function ActiveWorkoutScreen({ sessionId }: ActiveWorkoutScreenProps) {
  const { t } = useTranslation('workout');
  const { user } = useAuth();
  const workout = useWorkoutSessionDetails(user?.id ?? '', sessionId);

  if (workout.isPending) {
    return (
      <StackScrollScreen>
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      </StackScrollScreen>
    );
  }

  if (workout.isError || !workout.data) {
    return (
      <StackScrollScreen>
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={() => void workout.refetch()}
          title={t('status.errorTitle')}
        />
      </StackScrollScreen>
    );
  }

  return <ActiveWorkoutContent key={workout.data.session.id} details={workout.data} />;
}

type ActiveWorkoutContentProps = {
  details: WorkoutSessionDetails;
};

function ActiveWorkoutContent({ details }: ActiveWorkoutContentProps) {
  const { t } = useTranslation(['workout', 'training']);
  const router = useRouter();
  const { profile, user } = useAuth();
  const unit = profile?.preferred_weight_unit ?? 'kg';
  const [exerciseIndex, setExerciseIndex] = useState(() =>
    getInitialExerciseIndex(details.exercises),
  );
  const [draftIds, setDraftIds] = useState<number[]>([]);
  const [nextDraftId, setNextDraftId] = useState(1);
  const saveSet = useSaveWorkoutSet(user?.id ?? '', details.session.id);
  const deleteSet = useDeleteWorkoutSet(user?.id ?? '', details.session.id);
  const finishWorkout = useFinishWorkoutSession();
  const elapsed = useWorkoutElapsedTime(details.session.started_at, details.session.completed_at);
  const exercise = details.exercises[exerciseIndex];

  if (!exercise) {
    return (
      <StackScrollScreen>
        <EmptyStateCard
          actionLabel={t('active.leave', { ns: 'workout' })}
          detail={t('launch.emptyPlan', { ns: 'workout' })}
          onAction={() => router.replace('/training')}
          title={details.session.workout_name_snapshot}
        />
      </StackScrollScreen>
    );
  }

  const navigateExercise = (nextIndex: number) => {
    setDraftIds([]);
    setExerciseIndex(nextIndex);
  };

  const confirmFinish = () => {
    Alert.alert(
      t('active.finishTitle', { ns: 'workout' }),
      t('active.finishDetail', { ns: 'workout' }),
      [
        { style: 'cancel', text: t('actions.cancel', { ns: 'workout' }) },
        {
          onPress: () =>
            finishWorkout.mutate(details.session.id, {
              onSuccess: () => router.replace(`/workout/history/${details.session.id}`),
            }),
          text: t('active.finish', { ns: 'workout' }),
        },
      ],
    );
  };

  const save = (input: SaveWorkoutSetInput, onSuccess: () => void) => {
    saveSet.mutate(input, { onSuccess });
  };

  return (
    <StackScrollScreen>
      <View style={{ gap: spacing.xl }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText color="primary" variant="label">
              {t('active.progress', {
                current: exerciseIndex + 1,
                ns: 'workout',
                total: details.exercises.length,
              })}
            </AppText>
            <AppText variant="heading">{details.session.workout_name_snapshot}</AppText>
          </View>
          <View style={{ alignItems: 'flex-end', gap: spacing.xxs }}>
            <AppText color="textMuted" variant="caption">
              {t('active.elapsed', { ns: 'workout' })}
            </AppText>
            <AppText color="primary" variant="title">
              {elapsed}
            </AppText>
          </View>
        </View>

        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ max: details.exercises.length, min: 0, now: exerciseIndex + 1 }}
          style={{
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.full,
            height: spacing.xs,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              height: '100%',
              width: `${((exerciseIndex + 1) / details.exercises.length) * 100}%`,
            }}
          />
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="display">{exercise.exercise_name_snapshot}</AppText>
          <AppText color="textSecondary">
            {t(`equipment.${exercise.equipment_snapshot}`, { ns: 'training' })} ·{' '}
            {t(`muscleGroups.${exercise.muscle_group_snapshot}`, { ns: 'training' })}
          </AppText>
        </View>

        <PreviousPerformanceCard
          currentDate={details.session.session_date}
          performance={exercise.previousPerformance}
          unit={unit}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <AppText variant="title">{t('active.todaySets', { ns: 'workout' })}</AppText>

        {exercise.sets.length === 0 && draftIds.length === 0 ? (
          <Card>
            <AppText color="textMuted" variant="caption">
              {t('active.noSets', { ns: 'workout' })}
            </AppText>
          </Card>
        ) : null}

        {exercise.sets.map((set) => (
          <SetEntryCard
            deleting={deleteSet.isPending}
            key={set.id}
            number={set.set_number}
            onDelete={(setId) => {
              if (setId) {
                deleteSet.mutate(setId);
              }
            }}
            onSave={save}
            saving={saveSet.isPending}
            sessionExerciseId={exercise.id}
            set={set}
            unit={unit}
          />
        ))}

        {draftIds.map((draftId, index) => (
          <SetEntryCard
            deleting={deleteSet.isPending}
            key={`draft-${draftId}`}
            number={exercise.sets.length + index + 1}
            onDelete={() => setDraftIds((current) => current.filter((id) => id !== draftId))}
            onSave={save}
            onSaved={() => setDraftIds((current) => current.filter((id) => id !== draftId))}
            saving={saveSet.isPending}
            sessionExerciseId={exercise.id}
            set={null}
            unit={unit}
          />
        ))}

        <AppButton
          disabled={saveSet.isPending || deleteSet.isPending}
          onPress={() => {
            setDraftIds((current) => [...current, nextDraftId]);
            setNextDraftId((current) => current + 1);
          }}
          title={t('active.addSet', { ns: 'workout' })}
          variant="secondary"
        />

        {saveSet.isError || deleteSet.isError ? (
          <AppText color="danger" variant="caption">
            {t(saveSet.isError ? 'active.saveSetError' : 'active.deleteSetError', {
              ns: 'workout',
            })}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <AppButton
            disabled={exerciseIndex === 0}
            onPress={() => navigateExercise(exerciseIndex - 1)}
            style={{ flex: 1 }}
            title={t('active.previousExercise', { ns: 'workout' })}
            variant="secondary"
          />
          <AppButton
            disabled={exerciseIndex === details.exercises.length - 1}
            onPress={() => navigateExercise(exerciseIndex + 1)}
            style={{ flex: 1 }}
            title={t('active.nextExercise', { ns: 'workout' })}
            variant="secondary"
          />
        </View>
        <AppButton
          loading={finishWorkout.isPending}
          onPress={confirmFinish}
          title={t('active.finish', { ns: 'workout' })}
        />
        {finishWorkout.isError ? (
          <AppText color="danger" variant="caption">
            {t('active.finishError', { ns: 'workout' })}
          </AppText>
        ) : null}
      </View>

      <View style={{ height: layout.borderWidth }} />
    </StackScrollScreen>
  );
}
