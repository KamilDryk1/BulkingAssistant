import { useCalendars } from 'expo-localization';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { CompactAction } from '@/components/compact-action';
import { EmptyStateCard } from '@/components/empty-state-card';
import { QueryStateCard } from '@/components/query-state-card';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { useAuth } from '@/features/auth/auth-context';
import {
  useClaimDailyAnalysisForDisplay,
  useEnsureDailyAnalysis,
} from '@/features/ai/daily-analysis-queries';
import { ScheduleItemIcon } from '@/features/training/schedule-item-icon';
import { getDailyWorkoutExerciseReadState } from '@/features/training/daily-workout-exercise-state';
import { resolveScheduleForDate } from '@/features/training/training-domain';
import {
  useDailyScheduleOverride,
  useDailyWorkoutExerciseOverrides,
  useTrainingData,
} from '@/features/training/training-queries';
import type { WorkoutPlan } from '@/features/training/training-types';
import {
  useDeleteActivityLog,
  useLastCompletedWorkoutDates,
  useTodayData,
} from '@/features/today/today-queries';
import { useCurrentDate } from '@/features/today/use-current-date';
import { formatBodyWeight } from '@/features/units/weight';
import { getCalendarDayDifference } from '@/features/workout/workout-domain';
import {
  useActiveWorkoutSession,
  useStartWorkoutSession,
} from '@/features/workout/workout-queries';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, spacing } from '@/theme';
import type { ActivityLogRow, WorkoutSessionRow } from '@/types/database';
import { formatFullDate } from '@/utils/format-date';

function MacroStat({ label, value }: { label: string; value: number }) {
  const { t } = useTranslation('common');

  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <AppText adjustsFontSizeToFit numberOfLines={1} variant="label">
        {label}
      </AppText>
      <AppText color="textSecondary" selectable variant="bodyStrong">
        {value} {t('units.grams')}
      </AppText>
    </View>
  );
}

type PlannedWorkoutProps = {
  completedSession: WorkoutSessionRow | null;
  date: string;
  lastDate: string | null;
  onOpenHistory: (sessionId: string) => void;
  onStart: (planId: string) => void;
  plan: WorkoutPlan;
  starting: boolean;
};

function PlannedWorkout({
  completedSession,
  date,
  lastDate,
  onOpenHistory,
  onStart,
  plan,
  starting,
}: PlannedWorkoutProps) {
  const { t } = useTranslation('today');

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
        <ScheduleItemIcon itemType="workout" />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
            <AppText style={{ flex: 1 }} variant="title">
              {plan.name}
            </AppText>
            {completedSession ? (
              <AppText color="success" variant="label">
                {t('training.completed')}
              </AppText>
            ) : null}
          </View>
          <AppText color="textSecondary" variant="caption">
            {t('training.exerciseCount', { count: plan.exercises.length })}
            {' · '}
            {lastDate
              ? t('training.lastPerformed', {
                  count: getCalendarDayDifference(date, lastDate),
                })
              : t('training.neverPerformed')}
          </AppText>
        </View>
      </View>
      <AppButton
        disabled={!completedSession && plan.exercises.length === 0}
        loading={starting}
        onPress={() => (completedSession ? onOpenHistory(completedSession.id) : onStart(plan.id))}
        title={t(completedSession ? 'training.openCompleted' : 'training.start')}
        variant={completedSession ? 'secondary' : 'primary'}
      />
      {plan.exercises.length === 0 ? (
        <AppText color="warning" variant="caption">
          {t('training.emptyPlan')}
        </AppText>
      ) : null}
    </View>
  );
}

function LoggedActivityRow({
  activity,
  deleting,
  onDelete,
}: {
  activity: ActivityLogRow;
  deleting: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation('today');
  const details = [
    activity.duration_minutes
      ? t('activities.duration', { count: activity.duration_minutes })
      : null,
    activity.intensity ? t(`intensity.${activity.intensity}`) : null,
  ].filter(Boolean);

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText variant="bodyStrong">{activity.activity_name_snapshot}</AppText>
        {details.length > 0 ? (
          <AppText color="textMuted" variant="caption">
            {details.join(' · ')}
          </AppText>
        ) : null}
      </View>
      <AppText color="success" variant="bodyStrong">
        ✓
      </AppText>
      <CompactAction
        accessibilityLabel={t('activities.delete')}
        disabled={deleting}
        label="×"
        onPress={onDelete}
      />
    </View>
  );
}

export function TodayScreen() {
  const { t } = useTranslation(['today', 'common']);
  const router = useRouter();
  const { profile, user } = useAuth();
  const [calendar] = useCalendars();
  const locale = profile?.locale ?? getCurrentLocale();
  const { date, dateKey } = useCurrentDate();
  const training = useTrainingData(user?.id ?? '', locale);
  const dailyOverride = useDailyScheduleOverride(user?.id ?? '', dateKey);
  const dailyWorkoutExercises = useDailyWorkoutExerciseOverrides(user?.id ?? '', dateKey);
  const dailyWorkoutExerciseState = getDailyWorkoutExerciseReadState(dailyWorkoutExercises);
  const coachSchemaMissing = dailyWorkoutExerciseState === 'schema_missing';
  const today = useTodayData(user?.id ?? '', dateKey, profile);
  const timeZone = calendar?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const dailyAnalysis = useEnsureDailyAnalysis(
    user?.id ?? '',
    dateKey,
    timeZone,
    Boolean(today.data && profile?.onboarding_completed_at),
  );
  const claimDailyAnalysis = useClaimDailyAnalysisForDisplay();
  const openingAnalysisId = useRef<string | null>(null);
  const activeWorkout = useActiveWorkoutSession(user?.id ?? '');
  const activeSession = activeWorkout.data;
  const startWorkout = useStartWorkoutSession();
  const deleteActivity = useDeleteActivityLog();
  const resolvedSchedule = training.data
    ? resolveScheduleForDate(dateKey, training.data.weeklySchedule, dailyOverride.data ?? null)
    : null;
  const scheduledPlans =
    training.data && resolvedSchedule
      ? resolvedSchedule.items.flatMap((item) => {
          const plan =
            item.itemType === 'workout'
              ? training.data.plans.find((candidate) => candidate.id === item.referenceId)
              : null;
          if (!plan) {
            return [];
          }

          const exerciseIds = coachSchemaMissing
            ? undefined
            : dailyWorkoutExercises.data?.[plan.id];
          if (!exerciseIds) {
            return [plan];
          }

          const exerciseById = new Map(
            plan.exercises.map((planExercise) => [planExercise.exercise.id, planExercise]),
          );
          const trainingExerciseById = new Map(
            training.data.exercises.map((exercise) => [exercise.id, exercise]),
          );
          return [
            {
              ...plan,
              exercises: exerciseIds.flatMap((exerciseId, position) => {
                const existing = exerciseById.get(exerciseId);
                const exercise = existing?.exercise ?? trainingExerciseById.get(exerciseId);
                return exercise
                  ? [
                      {
                        exercise,
                        id: existing?.id ?? `daily-${plan.id}-${exerciseId}`,
                        position,
                      },
                    ]
                  : [];
              }),
            },
          ];
        })
      : [];
  const lastWorkoutDates = useLastCompletedWorkoutDates(
    user?.id ?? '',
    dateKey,
    scheduledPlans.map((plan) => plan.id),
  );
  const loading =
    training.isPending ||
    dailyOverride.isPending ||
    dailyWorkoutExerciseState === 'loading' ||
    today.isPending ||
    activeWorkout.isPending;
  const failed =
    training.isError ||
    dailyOverride.isError ||
    dailyWorkoutExerciseState === 'error' ||
    today.isError ||
    activeWorkout.isError;
  const dateLabel = formatFullDate(date, locale);

  useEffect(() => {
    const analysis = dailyAnalysis.data?.analysis;
    if (
      analysis?.status !== 'suggestion' ||
      analysis.first_shown_at ||
      analysis.accepted_at ||
      analysis.dismissed_at ||
      openingAnalysisId.current === analysis.id
    ) {
      return;
    }

    openingAnalysisId.current = analysis.id;
    claimDailyAnalysis.mutate(analysis.id, {
      onError: () => {
        openingAnalysisId.current = null;
      },
      onSuccess: (claimed) => {
        if (claimed) {
          router.push({
            pathname: '/ai-suggestion',
            params: { analysisId: claimed.id },
          } as unknown as Href);
        }
      },
    });
  }, [claimDailyAnalysis, dailyAnalysis.data?.analysis, router]);

  const retry = () => {
    void training.refetch();
    void dailyOverride.refetch();
    void dailyWorkoutExercises.refetch();
    void today.refetch();
    void activeWorkout.refetch();
    void lastWorkoutDates.refetch();
  };

  const launchWorkout = (planId: string) => {
    startWorkout.mutate(planId, {
      onSuccess: (sessionId) => router.push(`/workout/${sessionId}`),
    });
  };

  const confirmActivityDelete = (activity: ActivityLogRow) => {
    Alert.alert(t('activities.deleteTitle'), t('activities.deleteDetail'), [
      { style: 'cancel', text: t('actions.cancel') },
      {
        onPress: () => deleteActivity.mutate(activity.id),
        style: 'destructive',
        text: t('actions.delete'),
      },
    ]);
  };

  if (loading) {
    return (
      <Screen header={<AppHeader eyebrow={t('eyebrow')} title={dateLabel} />}>
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      </Screen>
    );
  }

  if (failed || !training.data || !resolvedSchedule || !today.data) {
    return (
      <Screen header={<AppHeader eyebrow={t('eyebrow')} title={dateLabel} />}>
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={retry}
          title={t('status.errorTitle')}
        />
      </Screen>
    );
  }

  const target = today.data.nutritionTarget;
  const unit = profile?.preferred_weight_unit ?? 'kg';
  const unitLabel = t(unit === 'lb' ? 'units.pounds' : 'units.kilograms', { ns: 'common' });

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={dateLabel} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('coach.title')} />
        <Card elevated style={{ gap: spacing.md }}>
          <AppText variant="title">{t('coach.cardTitle')}</AppText>
          <AppText color="textSecondary">
            {t(coachSchemaMissing ? 'coach.setupRequired' : 'coach.cardDetail')}
          </AppText>
          <AppButton
            disabled={coachSchemaMissing}
            onPress={() => router.push('/coach' as Href)}
            title={t('coach.open')}
          />
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('nutritionTarget')} />
        <Card elevated padding="large" style={{ gap: spacing.xl }}>
          {target ? (
            <>
              <View style={{ gap: spacing.sm }}>
                <AppText color="textMuted" variant="caption">
                  {t('nutrition.dailyTarget')}
                </AppText>
                <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm }}>
                  <AppText color="primary" selectable variant="display">
                    {new Intl.NumberFormat(locale).format(target.calories)}
                  </AppText>
                  <AppText color="textMuted" variant="bodyStrong">
                    {t('units.calories', { ns: 'common' })}
                  </AppText>
                </View>
                {target.planned_training_calories !== null ? (
                  <AppText color="textSecondary" variant="caption">
                    {t('nutrition.plannedTrainingContribution', {
                      calories: new Intl.NumberFormat(locale).format(
                        target.planned_training_calories,
                      ),
                    })}
                  </AppText>
                ) : null}
              </View>
              <View
                style={{
                  backgroundColor: colors.border,
                  height: layout.borderWidth,
                  width: '100%',
                }}
              />
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <MacroStat label={t('protein')} value={target.protein_grams} />
                <MacroStat label={t('carbs')} value={target.carbohydrate_grams} />
                <MacroStat label={t('fat')} value={target.fat_grams} />
              </View>
            </>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="title">{t('nutrition.unavailableTitle')}</AppText>
              <AppText color="textSecondary">{t('nutrition.unavailableDetail')}</AppText>
            </View>
          )}
          <AppButton
            onPress={() => router.push('/body')}
            title={t('navigation.openBody')}
            variant="secondary"
          />
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('plannedTraining')} />
        {activeSession ? (
          <Card elevated style={{ gap: spacing.lg }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
              <ScheduleItemIcon itemType="workout" />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText color="primary" variant="label">
                  {t('training.active')}
                </AppText>
                <AppText variant="title">{activeSession.workout_name_snapshot}</AppText>
              </View>
            </View>
            <AppButton
              onPress={() => router.push(`/workout/${activeSession.id}`)}
              title={t('training.resume')}
            />
          </Card>
        ) : resolvedSchedule.items.length === 0 ? (
          <EmptyStateCard
            actionLabel={t('chooseWorkout')}
            detail={t('noWorkoutDetail')}
            onAction={() =>
              router.push({ pathname: '/training-tools/override', params: { date: dateKey } })
            }
            title={t('noWorkout')}
          />
        ) : (
          <Card elevated style={{ gap: spacing.lg }}>
            <AppText color="primary" variant="label">
              {t(
                resolvedSchedule.source === 'override'
                  ? 'training.overrideSource'
                  : 'training.weeklySource',
              )}
            </AppText>
            {resolvedSchedule.items.map((item, index) => {
              if (item.itemType === 'rest') {
                return (
                  <View
                    key={`rest-${index}`}
                    style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}
                  >
                    <ScheduleItemIcon itemType="rest" />
                    <AppText style={{ flex: 1 }} variant="title">
                      {t('training.rest')}
                    </AppText>
                  </View>
                );
              }

              if (item.itemType === 'activity') {
                const activity = training.data.activities.find(
                  (candidate) => candidate.id === item.referenceId,
                );
                const completed = today.data.activities.some(
                  (log) => log.activity_definition_id === item.referenceId,
                );

                return activity ? (
                  <View
                    key={`${item.itemType}-${item.referenceId}-${index}`}
                    style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}
                  >
                    <ScheduleItemIcon activitySlug={activity.slug} itemType="activity" />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="title">{activity.displayName}</AppText>
                      <AppText color="textMuted" variant="caption">
                        {t('training.plannedActivity')}
                      </AppText>
                    </View>
                    {completed ? (
                      <AppText color="success" variant="label">
                        {t('training.completed')}
                      </AppText>
                    ) : null}
                  </View>
                ) : null;
              }

              const plan = training.data.plans.find(
                (candidate) => candidate.id === item.referenceId,
              );
              const completedSession =
                today.data.completedWorkouts.find(
                  (session) => session.workout_plan_id === item.referenceId,
                ) ?? null;

              return plan ? (
                <PlannedWorkout
                  completedSession={completedSession}
                  date={dateKey}
                  key={`${item.itemType}-${item.referenceId}-${index}`}
                  lastDate={lastWorkoutDates.data?.[plan.id] ?? null}
                  onOpenHistory={(sessionId) => router.push(`/workout/history/${sessionId}`)}
                  onStart={launchWorkout}
                  plan={plan}
                  starting={startWorkout.isPending && startWorkout.variables === plan.id}
                />
              ) : null;
            })}
            <AppButton
              onPress={() =>
                router.push({ pathname: '/training-tools/override', params: { date: dateKey } })
              }
              title={t('training.change')}
              variant="secondary"
            />
            {startWorkout.isError ? (
              <AppText color="danger" variant="caption">
                {t('training.startError')}
              </AppText>
            ) : null}
          </Card>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('activities.title')} />
        {today.data.activities.length === 0 && today.data.completedWorkouts.length === 0 ? (
          <EmptyStateCard detail={t('noActivitiesDetail')} title={t('noActivities')} />
        ) : (
          <Card style={{ gap: spacing.lg }}>
            {today.data.completedWorkouts.map((session) => (
              <View
                key={session.id}
                style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}
              >
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <AppText variant="bodyStrong">{session.workout_name_snapshot}</AppText>
                  <AppText color="textMuted" variant="caption">
                    {t('activities.strengthWorkout')}
                  </AppText>
                </View>
                <AppText color="success" variant="bodyStrong">
                  ✓
                </AppText>
              </View>
            ))}
            {today.data.activities.map((activity) => (
              <LoggedActivityRow
                activity={activity}
                deleting={deleteActivity.isPending}
                key={activity.id}
                onDelete={() => confirmActivityDelete(activity)}
              />
            ))}
          </Card>
        )}
        <AppButton
          onPress={() => router.push('/today-activity')}
          title={t('activities.add')}
          variant="secondary"
        />
        {deleteActivity.isError ? (
          <AppText color="danger" variant="caption">
            {t('activities.deleteError')}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('bodyWeight')} />
        <Card style={{ gap: spacing.lg }}>
          {today.data.todayWeight ? (
            <View style={{ gap: spacing.xs }}>
              <AppText color="textMuted" variant="caption">
                {t('weight.today')}
              </AppText>
              <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm }}>
                <AppText selectable variant="display">
                  {formatBodyWeight(today.data.todayWeight.weight_kg, unit)}
                </AppText>
                <AppText color="textMuted" variant="bodyStrong">
                  {unitLabel}
                </AppText>
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.xs }}>
              <AppText variant="bodyStrong">{t('noWeight')}</AppText>
              <AppText color="textMuted" variant="caption">
                {today.data.latestWeight
                  ? t('weight.latest', {
                      unit: unitLabel,
                      value: formatBodyWeight(today.data.latestWeight.weight_kg, unit),
                    })
                  : t('noWeightDetail')}
              </AppText>
            </View>
          )}
          {today.data.sevenDayAverageKg !== null ? (
            <AppText color="textSecondary" variant="caption">
              {t('weight.average', {
                unit: unitLabel,
                value: formatBodyWeight(today.data.sevenDayAverageKg, unit),
              })}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <AppButton
              onPress={() => router.push('/today-weight')}
              style={{ flex: 1 }}
              title={t(today.data.todayWeight ? 'weight.edit' : 'weight.log')}
              variant="secondary"
            />
            <AppButton
              onPress={() => router.push('/body')}
              style={{ flex: 1 }}
              title={t('navigation.openBody')}
              variant="ghost"
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
