import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { ScheduleItemsEditor } from '@/features/training/schedule-items-editor';
import { isScheduleDraftValid } from '@/features/training/training-domain';
import { useReplaceWeeklyScheduleDay, useTrainingData } from '@/features/training/training-queries';
import type { ScheduleDraftItem } from '@/features/training/training-types';
import { getCurrentLocale } from '@/i18n';
import { spacing } from '@/theme';

type ScheduleDayEditorScreenProps = {
  weekday: number;
};

export function ScheduleDayEditorScreen({ weekday }: ScheduleDayEditorScreenProps) {
  const { t } = useTranslation('training');
  const router = useRouter();
  const { profile, user } = useAuth();
  const training = useTrainingData(user?.id ?? '', profile?.locale ?? getCurrentLocale());
  const replaceDay = useReplaceWeeklyScheduleDay();
  const initialized = useRef(false);
  const [items, setItems] = useState<ScheduleDraftItem[]>([]);

  useEffect(() => {
    if (!training.data || initialized.current) {
      return;
    }

    initialized.current = true;
    setItems(
      training.data.weeklySchedule
        .filter((item) => item.weekday === weekday)
        .map(({ durationMinutes, intensity, itemType, referenceId }) => ({
          durationMinutes,
          intensity,
          itemType,
          referenceId,
        })),
    );
  }, [training.data, weekday]);

  const save = () => {
    replaceDay.mutate({ items, weekday }, { onSuccess: () => router.back() });
  };

  return (
    <StackScrollScreen>
      <AppText color="textSecondary" variant="title">
        {t(`weekdays.${weekday}`)}
      </AppText>

      {training.isPending ? (
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      ) : training.isError ? (
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={() => void training.refetch()}
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
          {replaceDay.isError ? (
            <AppText color="danger" variant="caption">
              {t('scheduleEditor.saveError')}
            </AppText>
          ) : null}
          <AppButton
            disabled={!isScheduleDraftValid(items)}
            loading={replaceDay.isPending}
            onPress={save}
            title={t('scheduleEditor.save')}
          />
        </View>
      )}
    </StackScrollScreen>
  );
}
