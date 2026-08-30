import { Host, Picker } from '@expo/ui';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { QueryStateCard } from '@/components/query-state-card';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { useAuth } from '@/features/auth/auth-context';
import { ProgressChart } from '@/features/progress/progress-chart';
import {
  buildProgressSessionPoints,
  getProgressSummary,
  progressPeriodWeeks,
} from '@/features/progress/progress-domain';
import { useProgressData } from '@/features/progress/progress-queries';
import type {
  ProgressExercise,
  ProgressMode,
  ProgressTrend,
} from '@/features/progress/progress-types';
import { useCurrentDate } from '@/features/today/use-current-date';
import { kilogramsToPounds } from '@/features/units/weight';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, opacity, radius, spacing } from '@/theme';
import type { AppLocale, WeightUnit } from '@/types/database';

function formatWeight(weightKg: number, unit: WeightUnit, locale: AppLocale) {
  const value = unit === 'lb' ? kilogramsToPounds(weightKg) : weightKg;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);
}

function formatSignedWeight(weightKg: number, unit: WeightUnit, locale: AppLocale) {
  const value = unit === 'lb' ? kilogramsToPounds(weightKg) : weightKg;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(Math.abs(value))}`;
}

function ModeButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: selected ? colors.surfaceSelected : colors.transparent,
        borderCurve: 'continuous',
        borderRadius: radius.sm,
        flex: 1,
        justifyContent: 'center',
        minHeight: layout.minTouchTarget,
        opacity: pressed ? opacity.pressed : 1,
        paddingHorizontal: spacing.md,
      })}
    >
      <AppText color={selected ? 'primary' : 'textMuted'} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function ModeSelector({
  mode,
  onChange,
}: {
  mode: ProgressMode;
  onChange: (mode: ProgressMode) => void;
}) {
  const { t } = useTranslation('progress');

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        backgroundColor: colors.surface,
        borderCurve: 'continuous',
        borderRadius: radius.md,
        flexDirection: 'row',
        gap: spacing.xs,
        padding: spacing.xs,
      }}
    >
      <ModeButton
        label={t('modes.estimatedOneRepMax')}
        onPress={() => onChange('estimatedOneRepMax')}
        selected={mode === 'estimatedOneRepMax'}
      />
      <ModeButton
        label={t('modes.bestSet')}
        onPress={() => onChange('bestSet')}
        selected={mode === 'bestSet'}
      />
    </View>
  );
}

function ExercisePicker({
  exercises,
  label,
  onChange,
  value,
}: {
  exercises: readonly ProgressExercise[];
  label: string;
  onChange: (exerciseId: string) => void;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="bodyStrong">{label}</AppText>
      <Card padding="default">
        <Host
          colorScheme="dark"
          seedColor={colors.primary}
          style={{ height: layout.buttonHeight, width: '100%' }}
        >
          <Picker appearance="menu" onValueChange={onChange} selectedValue={value}>
            {exercises.map((exercise) => (
              <Picker.Item key={exercise.id} label={exercise.displayName} value={exercise.id} />
            ))}
          </Picker>
        </Host>
      </Card>
    </View>
  );
}

function getTrendColor(trend: ProgressTrend | null) {
  const value = trend?.kind === 'weight' ? trend.valueKg : trend?.value;
  if (!value) {
    return 'textMuted' as const;
  }
  return value > 0 ? ('success' as const) : ('danger' as const);
}

export function ProgressScreen() {
  const { t } = useTranslation(['progress', 'common']);
  const { profile, user } = useAuth();
  const { dateKey } = useCurrentDate();
  const locale = profile?.locale ?? getCurrentLocale();
  const progress = useProgressData(user?.id ?? '', locale, dateKey);
  const [mode, setMode] = useState<ProgressMode>('estimatedOneRepMax');
  const [requestedExerciseId, setRequestedExerciseId] = useState('');
  const selectedExerciseId = progress.data?.exercises.some(
    (exercise) => exercise.id === requestedExerciseId,
  )
    ? requestedExerciseId
    : (progress.data?.exercises[0]?.id ?? '');
  const sessionPoints = useMemo(
    () => buildProgressSessionPoints(progress.data?.sets ?? [], selectedExerciseId),
    [progress.data?.sets, selectedExerciseId],
  );
  const summary = useMemo(() => getProgressSummary(sessionPoints, mode), [mode, sessionPoints]);

  if (progress.isPending) {
    return (
      <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      </Screen>
    );
  }

  if (progress.isError || !progress.data || !profile || !user) {
    return (
      <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={() => void progress.refetch()}
          title={t('status.errorTitle')}
        />
      </Screen>
    );
  }

  if (progress.data.exercises.length === 0) {
    return (
      <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
        <View style={{ gap: spacing.md }}>
          <SectionLabel title={t('exercise')} />
          <EmptyStateCard detail={t('empty.detail')} title={t('empty.title')} />
        </View>
      </Screen>
    );
  }

  const unit = profile.preferred_weight_unit;
  const unitLabel = t(unit === 'lb' ? 'units.pounds' : 'units.kilograms', { ns: 'common' });
  const current = summary.current;
  const sourceSet = current
    ? t('current.sourceSet', {
        reps: current.reps,
        unit: unitLabel,
        weight: formatWeight(current.weightKg, unit, locale),
      })
    : null;
  const trendText = summary.trend
    ? summary.trend.kind === 'weight'
      ? t('trend.weight', {
          unit: unitLabel,
          value: formatSignedWeight(summary.trend.valueKg, unit, locale),
          weeks: progressPeriodWeeks,
        })
      : t('trend.reps', {
          count: Math.abs(summary.trend.value),
          sign: summary.trend.value > 0 ? '+' : '−',
          weeks: progressPeriodWeeks,
        })
    : t('trend.unavailable');

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('exercise')} />
        <ExercisePicker
          exercises={progress.data.exercises}
          label={t('exercisePicker.label')}
          onChange={setRequestedExerciseId}
          value={selectedExerciseId}
        />
      </View>

      <ModeSelector mode={mode} onChange={setMode} />

      <Card elevated padding="large" style={{ gap: spacing.xxl }}>
        {current ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="label">
                {t(
                  mode === 'estimatedOneRepMax' ? 'current.estimatedOneRepMax' : 'current.bestSet',
                )}
              </AppText>
              <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm }}>
                <AppText color="primary" selectable variant="stat">
                  {formatWeight(current.valueKg, unit, locale)}
                </AppText>
                <AppText color="textMuted" variant="bodyStrong">
                  {unitLabel}
                </AppText>
                {mode === 'bestSet' ? (
                  <AppText color="textSecondary" selectable variant="title">
                    × {current.reps}
                  </AppText>
                ) : null}
              </View>
              {mode === 'estimatedOneRepMax' && sourceSet ? (
                <AppText color="textMuted" variant="caption">
                  {sourceSet}
                </AppText>
              ) : null}
              <AppText color={getTrendColor(summary.trend)} selectable variant="bodyStrong">
                {trendText}
              </AppText>
            </View>

            <View
              style={{
                backgroundColor: colors.border,
                height: layout.borderWidth,
                width: '100%',
              }}
            />

            <View style={{ gap: spacing.xs }}>
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <AppText variant="bodyStrong">{t('chart.title')}</AppText>
                <AppText color="textMuted" variant="caption">
                  {t('chart.period', { weeks: progressPeriodWeeks })}
                </AppText>
              </View>
              <AppText color="textMuted" variant="caption">
                {t(
                  mode === 'estimatedOneRepMax'
                    ? 'chart.estimatedOneRepMaxDetail'
                    : 'chart.bestSetDetail',
                )}
              </AppText>
            </View>

            <ProgressChart
              accessibilityLabel={t(
                mode === 'estimatedOneRepMax'
                  ? 'chart.estimatedOneRepMaxAccessibilityLabel'
                  : 'chart.bestSetAccessibilityLabel',
              )}
              locale={locale}
              points={summary.points}
              unit={unit}
            />
          </>
        ) : (
          <EmptyStateCard detail={t('noData.detail')} title={t('noData.title')} />
        )}
      </Card>

      <AppText color="textMuted" style={{ textAlign: 'center' }} variant="caption">
        {t(mode === 'estimatedOneRepMax' ? 'method.estimatedOneRepMax' : 'method.bestSet')}
      </AppText>
    </Screen>
  );
}
