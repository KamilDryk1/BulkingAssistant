import { SymbolView } from 'expo-symbols';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import {
  formatElapsedTime,
  formatWorkoutDate,
  getElapsedSeconds,
} from '@/features/workout/workout-domain';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, opacity, radius, spacing } from '@/theme';

import type { WorkoutHistoryItem } from './workout-types';

type WorkoutHistoryCardProps = {
  deleting?: boolean;
  item: WorkoutHistoryItem;
  locale?: string;
  onDelete: () => void;
  onPress: () => void;
  onSwipeableWillOpen?: (methods: SwipeableMethods) => void;
};

type DeleteActionProps = {
  accessibilityLabel: string;
  deleting: boolean;
  onDelete: () => void;
  progress: SharedValue<number>;
  swipeableMethods: SwipeableMethods;
};

function DeleteAction({
  accessibilityLabel,
  deleting,
  onDelete,
  progress,
  swipeableMethods,
}: DeleteActionProps) {
  const reducedMotion = useReducedMotion();
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0.35, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: reducedMotion
          ? 1
          : interpolate(progress.get(), [0, 1], [0.88, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: deleting, disabled: deleting }}
      disabled={deleting}
      onPress={() => {
        swipeableMethods.close();
        onDelete();
      }}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: colors.danger,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        justifyContent: 'center',
        opacity: pressed ? opacity.pressed : 1,
        width: layout.swipeActionWidth,
      })}
    >
      {deleting ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Animated.View style={iconStyle}>
          <SymbolView
            name={{ android: 'delete', ios: 'trash.fill' }}
            resizeMode="scaleAspectFit"
            size={layout.iconMedium}
            tintColor={colors.background}
          />
        </Animated.View>
      )}
    </Pressable>
  );
}

export function WorkoutHistoryCard({
  deleting = false,
  item,
  locale = getCurrentLocale(),
  onDelete,
  onPress,
  onSwipeableWillOpen,
}: WorkoutHistoryCardProps) {
  const { t } = useTranslation('workout');
  const duration = formatElapsedTime(getElapsedSeconds(item.started_at, item.completed_at));
  const swipeableRef = useRef<SwipeableMethods | null>(null);
  const renderRightActions = useCallback(
    (
      progress: SharedValue<number>,
      _translation: SharedValue<number>,
      methods: SwipeableMethods,
    ) => (
      <DeleteAction
        accessibilityLabel={t('history.deleteAction')}
        deleting={deleting}
        onDelete={onDelete}
        progress={progress}
        swipeableMethods={methods}
      />
    ),
    [deleting, onDelete, t],
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      enableTrackpadTwoFingerGesture
      enabled={!deleting}
      friction={1}
      onSwipeableWillOpen={() => {
        if (swipeableRef.current) {
          onSwipeableWillOpen?.(swipeableRef.current);
        }
      }}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={renderRightActions}
      rightThreshold={layout.swipeActionWidth / 2}
      containerStyle={{
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        overflow: 'visible',
      }}
    >
      <Pressable
        accessibilityActions={[{ label: t('history.deleteAction'), name: 'delete' }]}
        accessibilityRole="button"
        accessibilityState={{ busy: deleting, disabled: deleting }}
        disabled={deleting}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') {
            onDelete();
          }
        }}
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: deleting ? opacity.disabled : pressed ? opacity.pressed : 1,
        })}
      >
        <Card elevated style={{ gap: spacing.md }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="title">{item.workout_name_snapshot}</AppText>
              <AppText color="textMuted" variant="caption">
                {formatWorkoutDate(item.session_date, locale)}
              </AppText>
            </View>
            {deleting ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <AppText
                accessibilityElementsHidden
                color="textMuted"
                importantForAccessibility="no"
                variant="title"
              >
                ›
              </AppText>
            )}
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
    </ReanimatedSwipeable>
  );
}
