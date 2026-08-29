import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { getIsoWeekday } from '@/features/training/training-domain';
import { ScheduleItemsEditor } from '@/features/training/schedule-items-editor';
import {
  useDailyScheduleOverride,
  useDeleteDailyScheduleOverride,
  useReplaceDailyScheduleOverride,
  useTrainingData,
} from '@/features/training/training-queries';
import type { ScheduleDraftItem } from '@/features/training/training-types';
import { getCurrentLocale } from '@/i18n';
import { spacing } from '@/theme';

type DailyScheduleOverrideScreenProps = {
  date: string;
};

function formatDate(dateKey: string, locale: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function DailyScheduleOverrideScreen({ date }: DailyScheduleOverrideScreenProps) {
  const { t } = useTranslation('training');
  const router = useRouter();
  const { profile, user } = useAuth();
  const locale = profile?.locale ?? getCurrentLocale();
  const training = useTrainingData(user?.id ?? '', locale);
  const dailyOverride = useDailyScheduleOverride(user?.id ?? '', date);
  const replaceOverride = useReplaceDailyScheduleOverride(user?.id ?? '', date);
  const deleteOverride = useDeleteDailyScheduleOverride(user?.id ?? '', date);
  const initialized = useRef(false);
  const [items, setItems] = useState<ScheduleDraftItem[]>([]);
  const weeklyItems = useMemo(
    () =>
      (training.data?.weeklySchedule ?? [])
        .filter((item) => item.weekday === getIsoWeekday(date))
        .map(({ itemType, referenceId }) => ({ itemType, referenceId })),
    [date, training.data?.weeklySchedule],
  );

  useEffect(() => {
    if (!training.data || dailyOverride.isPending || initialized.current) {
      return;
    }

    initialized.current = true;
    setItems(dailyOverride.data?.items ?? weeklyItems);
  }, [dailyOverride.data, dailyOverride.isPending, training.data, weeklyItems]);

  const resetOverride = () => {
    Alert.alert(t('overrideScreen.resetTitle'), t('overrideScreen.resetDetail'), [
      { style: 'cancel', text: t('actions.cancel') },
      {
        onPress: () => deleteOverride.mutate(undefined, { onSuccess: () => router.back() }),
        style: 'destructive',
        text: t('overrideScreen.reset'),
      },
    ]);
  };

  const isPending = training.isPending || dailyOverride.isPending;
  const isError = training.isError || dailyOverride.isError;

  return (
    <StackScrollScreen>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="title">
          {t('overrideScreen.date', { date: formatDate(date, locale) })}
        </AppText>
        <AppText color="textSecondary">
          {dailyOverride.data ? t('overrideScreen.introOverride') : t('overrideScreen.introWeekly')}
        </AppText>
      </View>

      {isPending ? (
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      ) : isError || !training.data ? (
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={() => {
            void training.refetch();
            void dailyOverride.refetch();
          }}
          title={t('status.errorTitle')}
        />
      ) : (
        <View style={{ gap: spacing.xxl }}>
          <ScheduleItemsEditor
            activities={training.data.activities}
            items={items}
            onChange={setItems}
            plans={training.data.plans}
          />
          {replaceOverride.isError ? (
            <AppText color="danger" variant="caption">
              {t('scheduleEditor.saveError')}
            </AppText>
          ) : null}
          {deleteOverride.isError ? (
            <AppText color="danger" variant="caption">
              {t('overrideScreen.resetError')}
            </AppText>
          ) : null}
          <AppButton
            loading={replaceOverride.isPending}
            onPress={() => replaceOverride.mutate(items, { onSuccess: () => router.back() })}
            title={t('overrideScreen.save')}
          />
          {dailyOverride.data ? (
            <AppButton
              disabled={replaceOverride.isPending}
              loading={deleteOverride.isPending}
              onPress={resetOverride}
              title={t('overrideScreen.reset')}
              variant="ghost"
            />
          ) : null}
        </View>
      )}
    </StackScrollScreen>
  );
}
