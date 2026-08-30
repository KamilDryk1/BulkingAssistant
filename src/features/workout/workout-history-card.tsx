import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import {
  formatElapsedTime,
  formatWorkoutDate,
  getElapsedSeconds,
} from '@/features/workout/workout-domain';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, opacity, spacing } from '@/theme';

import type { WorkoutHistoryItem } from './workout-types';

type WorkoutHistoryCardProps = {
  item: WorkoutHistoryItem;
  locale?: string;
  onPress: () => void;
};

export function WorkoutHistoryCard({
  item,
  locale = getCurrentLocale(),
  onPress,
}: WorkoutHistoryCardProps) {
  const { t } = useTranslation('workout');
  const duration = formatElapsedTime(getElapsedSeconds(item.started_at, item.completed_at));

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? opacity.pressed : 1 })}
    >
      <Card elevated style={{ gap: spacing.md }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="title">{item.workout_name_snapshot}</AppText>
            <AppText color="textMuted" variant="caption">
              {formatWorkoutDate(item.session_date, locale)}
            </AppText>
          </View>
          <AppText
            accessibilityElementsHidden
            color="textMuted"
            importantForAccessibility="no"
            variant="title"
          >
            ›
          </AppText>
        </View>
        <View
          style={{
            borderTopColor: colors.border,
            borderTopWidth: layout.borderWidth,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.md,
            paddingTop: spacing.md,
          }}
        >
          <AppText color="textSecondary" variant="caption">
            {t('history.exerciseCount', { count: item.exerciseCount })}
          </AppText>
          <AppText color="textSecondary" variant="caption">
            {t('history.setCount', { count: item.completedSetCount })}
          </AppText>
          <AppText color="textSecondary" variant="caption">
            {t('history.duration', { duration })}
          </AppText>
        </View>
        <AppText color="textMuted" numberOfLines={2} variant="caption">
          {item.exerciseNames.join(' · ')}
        </AppText>
      </Card>
    </Pressable>
  );
}
