import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { CompactAction } from '@/components/compact-action';
import { ReorderableList } from '@/components/reorderable-list';
import { SectionLabel } from '@/components/section-label';
import { colors, layout, opacity, radius, spacing } from '@/theme';

import { addScheduleItem, moveItem } from './training-domain';
import type { ActivityDefinition, ScheduleDraftItem, WorkoutPlan } from './training-types';

type ScheduleItemsEditorProps = {
  activities: ActivityDefinition[];
  items: ScheduleDraftItem[];
  onChange: (items: ScheduleDraftItem[]) => void;
  plans: WorkoutPlan[];
};

function AddItemRow({
  detail,
  onPress,
  title,
}: {
  detail: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: layout.minTouchTarget,
        opacity: pressed ? opacity.pressed : 1,
        paddingVertical: spacing.sm,
      })}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          alignItems: 'center',
          backgroundColor: colors.primaryMuted,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          height: layout.iconLarge,
          justifyContent: 'center',
          width: layout.iconLarge,
        }}
      >
        <AppText color="primary" variant="title">
          +
        </AppText>
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText color="textMuted" variant="caption">
          {detail}
        </AppText>
      </View>
    </Pressable>
  );
}

export function ScheduleItemsEditor({
  activities,
  items,
  onChange,
  plans,
}: ScheduleItemsEditorProps) {
  const { t } = useTranslation('training');

  const getItemText = (item: ScheduleDraftItem) => {
    if (item.itemType === 'rest') {
      return {
        detail: t('scheduleEditor.rest'),
        title: t('scheduleEditor.rest'),
      };
    }

    if (item.itemType === 'workout') {
      return {
        detail: t('scheduleEditor.workout'),
        title:
          plans.find((plan) => plan.id === item.referenceId)?.name ??
          t('scheduleEditor.missingItem'),
      };
    }

    return {
      detail: t('scheduleEditor.activity'),
      title:
        activities.find((activity) => activity.id === item.referenceId)?.displayName ??
        t('scheduleEditor.missingItem'),
    };
  };

  return (
    <>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('scheduleEditor.planned')} />
        {items.length === 0 ? (
          <Card>
            <AppText color="textMuted">{t('scheduleEditor.empty')}</AppText>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {items.length > 1 ? (
              <AppText color="textMuted" variant="caption">
                {t('actions.reorderHint')}
              </AppText>
            ) : null}
            <ReorderableList
              itemKeys={items.map((item) => `${item.itemType}:${item.referenceId ?? 'rest'}`)}
              onMove={(fromIndex, toIndex) => onChange(moveItem(items, fromIndex, toIndex))}
              renderItem={(_itemKey, index) => {
                const item = items[index];
                const text = getItemText(item);

                return (
                  <Card style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
                    <View style={{ flex: 1, gap: spacing.xxs }}>
                      <AppText variant="bodyStrong">{text.title}</AppText>
                      <AppText color="textMuted" variant="caption">
                        {text.detail}
                      </AppText>
                    </View>
                    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                      <CompactAction
                        accessibilityLabel={t('actions.moveUp')}
                        disabled={index === 0}
                        label="↑"
                        onPress={() => onChange(moveItem(items, index, index - 1))}
                      />
                      <CompactAction
                        accessibilityLabel={t('actions.moveDown')}
                        disabled={index === items.length - 1}
                        label="↓"
                        onPress={() => onChange(moveItem(items, index, index + 1))}
                      />
                      <CompactAction
                        accessibilityLabel={t('actions.remove')}
                        label="×"
                        onPress={() =>
                          onChange(items.filter((_, itemIndex) => itemIndex !== index))
                        }
                      />
                    </View>
                  </Card>
                );
              }}
            />
          </View>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('scheduleEditor.addWorkout')} />
        <Card style={{ gap: spacing.xs }}>
          {plans.length === 0 ? (
            <AppText color="textMuted">{t('scheduleEditor.noPlans')}</AppText>
          ) : (
            plans.map((plan) => (
              <AddItemRow
                detail={t('plansScreen.exerciseCount', { count: plan.exercises.length })}
                key={plan.id}
                onPress={() =>
                  onChange(addScheduleItem(items, { itemType: 'workout', referenceId: plan.id }))
                }
                title={plan.name}
              />
            ))
          )}
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('scheduleEditor.addActivity')} />
        <Card style={{ gap: spacing.xs }}>
          {activities.map((activity) => (
            <AddItemRow
              detail={t('scheduleEditor.activity')}
              key={activity.id}
              onPress={() =>
                onChange(
                  addScheduleItem(items, {
                    itemType: 'activity',
                    referenceId: activity.id,
                  }),
                )
              }
              title={activity.displayName}
            />
          ))}
        </Card>
      </View>

      <CompactAction
        accessibilityLabel={t('scheduleEditor.setRest')}
        label={t('scheduleEditor.setRest')}
        onPress={() => onChange(addScheduleItem(items, { itemType: 'rest', referenceId: null }))}
        selected={items.length === 1 && items[0]?.itemType === 'rest'}
        style={{ width: '100%' }}
      />
    </>
  );
}
