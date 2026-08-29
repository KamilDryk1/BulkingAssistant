import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { spacing } from '@/theme';

import type { ActivityDefinition, ScheduleDraftItem, WorkoutPlan } from './training-types';

type ScheduleItemListProps = {
  activities: ActivityDefinition[];
  emptyLabel: string;
  items: readonly ScheduleDraftItem[];
  plans: WorkoutPlan[];
};

export function ScheduleItemList({ activities, emptyLabel, items, plans }: ScheduleItemListProps) {
  const { t } = useTranslation('training');

  if (items.length === 0) {
    return (
      <AppText color="textMuted" variant="caption">
        {emptyLabel}
      </AppText>
    );
  }

  return (
    <View style={{ gap: spacing.xs }}>
      {items.map((item, index) => {
        const label =
          item.itemType === 'rest'
            ? t('scheduleEditor.rest')
            : item.itemType === 'workout'
              ? (plans.find((plan) => plan.id === item.referenceId)?.name ??
                t('scheduleEditor.missingItem'))
              : (activities.find((activity) => activity.id === item.referenceId)?.displayName ??
                t('scheduleEditor.missingItem'));
        const typeLabel = t(`scheduleEditor.${item.itemType}`);

        return (
          <View
            key={`${item.itemType}-${item.referenceId ?? 'rest'}-${index}`}
            style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}
          >
            <AppText color="primary" variant="caption">
              •
            </AppText>
            <AppText style={{ flex: 1 }} variant="bodyStrong">
              {label}
            </AppText>
            <AppText color="textMuted" variant="caption">
              {typeLabel}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
