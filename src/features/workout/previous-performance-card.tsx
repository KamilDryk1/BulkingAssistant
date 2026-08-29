import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { formatWorkoutWeight, getCalendarDayDifference } from '@/features/workout/workout-domain';
import { colors, layout, spacing } from '@/theme';
import type { WeightUnit } from '@/types/database';

import type { PreviousExercisePerformance } from './workout-types';

type PreviousPerformanceCardProps = {
  currentDate: string;
  performance: PreviousExercisePerformance | null;
  unit: WeightUnit;
};

export function PreviousPerformanceCard({
  currentDate,
  performance,
  unit,
}: PreviousPerformanceCardProps) {
  const { t } = useTranslation(['workout', 'common']);

  if (!performance) {
    return (
      <Card style={{ gap: spacing.xs }}>
        <AppText variant="label">{t('active.noPrevious', { ns: 'workout' })}</AppText>
        <AppText color="textMuted" variant="caption">
          {t('active.noPreviousDetail', { ns: 'workout' })}
        </AppText>
      </Card>
    );
  }

  const dayDifference = getCalendarDayDifference(currentDate, performance.date);
  const unitLabel = t(unit === 'lb' ? 'units.pounds' : 'units.kilograms', { ns: 'common' });

  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="label">
        {t('active.lastTime', { count: dayDifference, ns: 'workout' })}
      </AppText>
      <View
        style={{
          borderTopColor: colors.border,
          borderTopWidth: layout.borderWidth,
          gap: spacing.sm,
          paddingTop: spacing.md,
        }}
      >
        {performance.sets.map((set) => (
          <View
            key={`${set.exercise_id}-${set.set_number}`}
            style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}
          >
            <AppText color="textMuted" style={{ minWidth: layout.iconMedium }} variant="caption">
              {set.set_number}
            </AppText>
            <AppText color="textSecondary" variant="bodyStrong">
              {formatWorkoutWeight(set.weight_kg, unit)} {unitLabel} × {set.reps}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}
