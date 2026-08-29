import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { EmptyStateCard } from '@/components/empty-state-card';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { WorkoutHistoryCard } from '@/features/workout/workout-history-card';
import { useWorkoutHistory } from '@/features/workout/workout-queries';
import { getCurrentLocale } from '@/i18n';
import { spacing } from '@/theme';

export function WorkoutHistoryScreen() {
  const { t } = useTranslation('workout');
  const router = useRouter();
  const { profile, user } = useAuth();
  const history = useWorkoutHistory(user?.id ?? '');
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <StackScrollScreen>
      <AppText color="textSecondary">{t('history.intro')}</AppText>

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
              item={item}
              key={item.id}
              locale={profile?.locale ?? getCurrentLocale()}
              onPress={() => router.push(`/workout/history/${item.id}`)}
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
