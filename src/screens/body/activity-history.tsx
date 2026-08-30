import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { ActivityLogRow } from '@/features/body/activity-log-row';
import { useActivityHistory } from '@/features/body/body-queries';
import { useAuth } from '@/features/auth/auth-context';
import { useDeleteActivityLog } from '@/features/today/today-queries';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, spacing } from '@/theme';
import type { ActivityLogRow as ActivityLog } from '@/types/database';

export function ActivityHistoryScreen() {
  const { t } = useTranslation('body');
  const router = useRouter();
  const { profile, user } = useAuth();
  const history = useActivityHistory(user?.id ?? '');
  const deleteActivity = useDeleteActivityLog();
  const activities = history.data?.pages.flatMap((page) => page.items) ?? [];
  const locale = profile?.locale ?? getCurrentLocale();

  const confirmDelete = (activity: ActivityLog) => {
    Alert.alert(t('activity.deleteTitle'), t('activity.deleteDetail'), [
      { style: 'cancel', text: t('actions.cancel') },
      {
        onPress: () => deleteActivity.mutate(activity.id),
        style: 'destructive',
        text: t('actions.delete'),
      },
    ]);
  };

  return (
    <StackScrollScreen>
      <AppText color="textSecondary">{t('activity.historyDetail')}</AppText>
      <AppButton onPress={() => router.push('/today-activity')} title={t('activity.add')} />

      {history.isPending ? (
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      ) : history.isError ? (
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={() => void history.refetch()}
          title={t('status.errorTitle')}
        />
      ) : activities.length === 0 ? (
        <EmptyStateCard detail={t('activity.emptyDetail')} title={t('activity.emptyTitle')} />
      ) : (
        <Card elevated padding="large" style={{ gap: spacing.lg }}>
          {activities.map((activity, index) => (
            <View key={activity.id} style={{ gap: spacing.lg }}>
              {index > 0 ? (
                <View
                  style={{
                    backgroundColor: colors.border,
                    height: layout.borderWidth,
                  }}
                />
              ) : null}
              <ActivityLogRow
                activity={activity}
                deleting={deleteActivity.isPending && deleteActivity.variables === activity.id}
                locale={locale}
                onDelete={() => confirmDelete(activity)}
              />
            </View>
          ))}
        </Card>
      )}

      {history.hasNextPage ? (
        <AppButton
          loading={history.isFetchingNextPage}
          onPress={() => void history.fetchNextPage()}
          title={t(history.isFetchingNextPage ? 'activity.loadingMore' : 'activity.loadMore')}
          variant="secondary"
        />
      ) : null}
    </StackScrollScreen>
  );
}
