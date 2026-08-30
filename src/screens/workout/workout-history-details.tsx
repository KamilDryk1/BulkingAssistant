import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import {
  formatElapsedTime,
  formatWorkoutDate,
  formatWorkoutWeight,
  getElapsedSeconds,
} from '@/features/workout/workout-domain';
import {
  useDeleteWorkoutSession,
  useWorkoutSessionDetails,
} from '@/features/workout/workout-queries';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, spacing } from '@/theme';

type WorkoutHistoryDetailsScreenProps = {
  onBack: () => void;
  sessionId: string;
};

export function WorkoutHistoryDetailsScreen({
  onBack,
  sessionId,
}: WorkoutHistoryDetailsScreenProps) {
  const { t } = useTranslation(['workout', 'common']);
  const { profile, user } = useAuth();
  const workout = useWorkoutSessionDetails(user?.id ?? '', sessionId);
  const deleteWorkout = useDeleteWorkoutSession();

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

  const { exercises, session } = workout.data;
  const unit = profile?.preferred_weight_unit ?? 'kg';
  const unitLabel = t(unit === 'lb' ? 'units.pounds' : 'units.kilograms', { ns: 'common' });
  const completedSets = exercises.reduce(
    (count, exercise) => count + exercise.sets.filter((set) => set.completed_at).length,
    0,
  );
  const locale = profile?.locale ?? getCurrentLocale();

  const confirmDelete = () => {
    Alert.alert(
      t('history.deleteTitle'),
      t('history.deleteDetail', { name: session.workout_name_snapshot }),
      [
        { style: 'cancel', text: t('actions.cancel') },
        {
          onPress: () => deleteWorkout.mutate(session.id, { onSuccess: onBack }),
          style: 'destructive',
          text: t('actions.delete'),
        },
      ],
    );
  };

  return (
    <StackScrollScreen>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">{session.workout_name_snapshot}</AppText>
        <AppText color="textSecondary">
          {t('details.performed', {
            date: formatWorkoutDate(session.session_date, locale),
            ns: 'workout',
          })}
        </AppText>
      </View>

      <Card elevated style={{ gap: spacing.lg }}>
        <AppText variant="label">{t('details.summary', { ns: 'workout' })}</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText color="textMuted" variant="caption">
              {t('details.duration', { ns: 'workout' })}
            </AppText>
            <AppText variant="title">
              {formatElapsedTime(getElapsedSeconds(session.started_at, session.completed_at))}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText color="textMuted" variant="caption">
              {t('details.completedSets', { ns: 'workout' })}
            </AppText>
            <AppText variant="title">{completedSets}</AppText>
          </View>
        </View>
      </Card>

      {exercises.length === 0 ? (
        <EmptyStateCard detail={t('details.noSets')} title={t('details.allSets')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {exercises.map((exercise, exerciseIndex) => (
            <Card key={exercise.id} style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <AppText color="primary" variant="label">
                  {String(exerciseIndex + 1).padStart(2, '0')}
                </AppText>
                <AppText style={{ flex: 1 }} variant="title">
                  {exercise.exercise_name_snapshot}
                </AppText>
              </View>
              {exercise.sets.length === 0 ? (
                <AppText color="textMuted" variant="caption">
                  {t('details.noSets', { ns: 'workout' })}
                </AppText>
              ) : (
                <View
                  style={{
                    borderTopColor: colors.border,
                    borderTopWidth: layout.borderWidth,
                    gap: spacing.sm,
                    paddingTop: spacing.md,
                  }}
                >
                  {exercise.sets.map((set) => (
                    <View
                      key={set.id}
                      style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}
                    >
                      <AppText color="textMuted" style={{ minWidth: layout.iconMedium }}>
                        {set.set_number}
                      </AppText>
                      <AppText style={{ flex: 1 }} variant="bodyStrong">
                        {formatWorkoutWeight(set.weight_kg, unit)} {unitLabel} × {set.reps}
                      </AppText>
                      <AppText color={set.completed_at ? 'success' : 'textMuted'} variant="caption">
                        {set.completed_at ? '✓' : t('details.notCompleted', { ns: 'workout' })}
                      </AppText>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          ))}
        </View>
      )}

      {deleteWorkout.isError ? (
        <AppText accessibilityLiveRegion="polite" color="danger" variant="caption">
          {t('history.deleteError')}
        </AppText>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <AppButton
          disabled={deleteWorkout.isPending}
          onPress={onBack}
          style={{ flex: 1 }}
          title={t('details.back')}
          variant="secondary"
        />
        <AppButton
          loading={deleteWorkout.isPending}
          onPress={confirmDelete}
          style={{ flex: 1 }}
          title={t('actions.delete')}
          variant="danger"
        />
      </View>
    </StackScrollScreen>
  );
}
