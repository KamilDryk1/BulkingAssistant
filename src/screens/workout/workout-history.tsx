import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyStateCard } from '@/components/empty-state-card';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { WorkoutHistoryCard } from '@/features/workout/workout-history-card';
import { useDeleteWorkoutSession, useWorkoutHistory } from '@/features/workout/workout-queries';
import type { WorkoutHistoryItem } from '@/features/workout/workout-types';
import { getCurrentLocale } from '@/i18n';
import { spacing } from '@/theme';

export function WorkoutHistoryScreen() {
  const { t } = useTranslation('workout');
  const router = useRouter();
  const { profile, user } = useAuth();
  const history = useWorkoutHistory(user?.id ?? '');
  const deleteWorkout = useDeleteWorkoutSession();
  const openSwipeable = useRef<SwipeableMethods | null>(null);
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  const handleSwipeableWillOpen = useCallback((methods: SwipeableMethods) => {
    if (openSwipeable.current && openSwipeable.current !== methods) {
      openSwipeable.current.close();
    }

    openSwipeable.current = methods;
  }, []);

  const confirmDelete = (item: WorkoutHistoryItem) => {
    Alert.alert(
      t('history.deleteTitle'),
      t('history.deleteDetail', { name: item.workout_name_snapshot }),
      [
        { style: 'cancel', text: t('actions.cancel') },
        {
          onPress: () => deleteWorkout.mutate(item.id),
          style: 'destructive',
          text: t('actions.delete'),
        },
      ],
    );
  };

  return (
    <StackScrollScreen>
      <AppText color="textSecondary">{t('history.intro')}</AppText>

      {deleteWorkout.isError ? (
        <AppText accessibilityLiveRegion="polite" color="danger" variant="caption">
          {t('history.deleteError')}
        </AppText>
      ) : null}

      {history.isPending ? (
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      ) : history.isError ? (
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={() => void history.refetch()}
          title={t('status.errorTitle')}
        />
      ) : items.length === 0 ? (
        <EmptyStateCard detail={t('history.emptyDetail')} title={t('history.emptyTitle')} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {items.map((item) => (
            <WorkoutHistoryCard
              deleting={deleteWorkout.isPending && deleteWorkout.variables === item.id}
              item={item}
              key={item.id}
              locale={profile?.locale ?? getCurrentLocale()}
              onDelete={() => confirmDelete(item)}
              onPress={() => router.push(`/workout/history/${item.id}`)}
              onSwipeableWillOpen={handleSwipeableWillOpen}
            />
          ))}
          {history.hasNextPage ? (
            <AppButton
              loading={history.isFetchingNextPage}
              onPress={() => void history.fetchNextPage()}
              title={t(history.isFetchingNextPage ? 'history.loadingMore' : 'history.loadMore')}
              variant="secondary"
            />
          ) : null}
        </View>
      )}
    </StackScrollScreen>
  );
}
