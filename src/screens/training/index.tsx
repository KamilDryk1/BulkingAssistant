import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { FeatureRow } from '@/components/feature-row';
import { QueryStateCard } from '@/components/query-state-card';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { useAuth } from '@/features/auth/auth-context';
import { getLocalDateKey, resolveScheduleForDate } from '@/features/training/training-domain';
import { useDailyScheduleOverride, useTrainingData } from '@/features/training/training-queries';
import { ScheduleItemList } from '@/features/training/schedule-item-list';
import {
  useActiveWorkoutSession,
  useStartWorkoutSession,
} from '@/features/workout/workout-queries';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, spacing } from '@/theme';

const separatorStyle = {
  backgroundColor: colors.border,
  height: layout.borderWidth,
  width: '100%' as const,
};

export function TrainingScreen() {
  const { t } = useTranslation(['training', 'workout']);
  const router = useRouter();
  const { profile, user } = useAuth();
  const date = getLocalDateKey();
  const training = useTrainingData(user?.id ?? '', profile?.locale ?? getCurrentLocale());
  const dailyOverride = useDailyScheduleOverride(user?.id ?? '', date);
  const activeWorkout = useActiveWorkoutSession(user?.id ?? '');
  const startWorkout = useStartWorkoutSession();
  const activeSession = activeWorkout.data;
  const resolvedSchedule = training.data
    ? resolveScheduleForDate(date, training.data.weeklySchedule, dailyOverride.data ?? null)
    : null;
  const scheduledPlans =
    training.data && resolvedSchedule
      ? resolvedSchedule.items.flatMap((item) => {
          if (item.itemType !== 'workout') {
            return [];
          }

          const plan = training.data.plans.find((candidate) => candidate.id === item.referenceId);
          return plan ? [plan] : [];
        })
      : [];

  const launchWorkout = (planId: string) => {
    startWorkout.mutate(planId, {
      onSuccess: (sessionId) => {
        router.push(`/workout/${sessionId}`);
      },
    });
  };

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('todayWorkout')} />
        {training.isPending || dailyOverride.isPending || activeWorkout.isPending ? (
          <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
        ) : training.isError ||
          dailyOverride.isError ||
          activeWorkout.isError ||
          !training.data ||
          !resolvedSchedule ? (
          <QueryStateCard
            actionLabel={t('status.retry')}
            detail={t('status.errorDetail')}
            onAction={() => {
              void training.refetch();
              void dailyOverride.refetch();
              void activeWorkout.refetch();
            }}
            title={t('status.errorTitle')}
          />
        ) : activeSession ? (
          <Card elevated style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <AppText color="primary" variant="label">
                {t('launch.resumeTitle', { ns: 'workout' })}
              </AppText>
              <AppText variant="title">{activeSession.workout_name_snapshot}</AppText>
              <AppText color="textSecondary" variant="caption">
                {t('launch.resumeDetail', {
                  name: activeSession.workout_name_snapshot,
                  ns: 'workout',
                })}
              </AppText>
            </View>
            <AppButton
              onPress={() => router.push(`/workout/${activeSession.id}`)}
              title={t('launch.resume', { ns: 'workout' })}
            />
          </Card>
        ) : resolvedSchedule.items.length === 0 ? (
          <EmptyStateCard
            actionLabel={t('chooseWorkout')}
            detail={t('noPlanDetail')}
            onAction={() => router.push({ pathname: '/training-tools/override', params: { date } })}
            title={t('noPlan')}
          />
        ) : (
          <Card elevated style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <AppText color="primary" variant="label">
                {resolvedSchedule.source === 'override'
                  ? t('today.overrideSource')
                  : t('today.weeklySource')}
              </AppText>
              <ScheduleItemList
                activities={training.data.activities}
                emptyLabel={t('noPlan')}
                items={resolvedSchedule.items}
                plans={training.data.plans}
              />
            </View>
            <AppButton
              onPress={() =>
                router.push({ pathname: '/training-tools/override', params: { date } })
              }
              title={t('today.edit')}
              variant="secondary"
            />
            {scheduledPlans.map((plan) => (
              <View key={plan.id} style={{ gap: spacing.sm }}>
                <AppButton
                  disabled={plan.exercises.length === 0}
                  loading={startWorkout.isPending && startWorkout.variables === plan.id}
                  onPress={() => launchWorkout(plan.id)}
                  title={t('launch.start', { name: plan.name, ns: 'workout' })}
                />
                {plan.exercises.length === 0 ? (
                  <AppText color="warning" variant="caption">
                    {t('launch.emptyPlan', { ns: 'workout' })}
                  </AppText>
                ) : null}
              </View>
            ))}
            {startWorkout.isError ? (
              <AppText color="danger" variant="caption">
                {t('launch.startError', { ns: 'workout' })}
              </AppText>
            ) : null}
          </Card>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('library')} />
        <Card style={{ gap: spacing.xs }}>
          <FeatureRow
            detail={t('plansDetail')}
            marker="01"
            onPress={() => router.push('/training-tools/plans')}
            title={t('plans')}
          />
          <View style={separatorStyle} />
          <FeatureRow
            detail={t('exercisesDetail')}
            marker="02"
            onPress={() => router.push('/training-tools/exercises')}
            title={t('exercises')}
          />
          <View style={separatorStyle} />
          <FeatureRow
            detail={t('scheduleDetail')}
            marker="03"
            onPress={() => router.push('/training-tools/schedule')}
            title={t('schedule')}
          />
          <View style={separatorStyle} />
          <FeatureRow
            detail={t('historyDetail')}
            marker="04"
            onPress={() => router.push('/workout/history')}
            title={t('history')}
          />
        </Card>
      </View>
    </Screen>
  );
}
