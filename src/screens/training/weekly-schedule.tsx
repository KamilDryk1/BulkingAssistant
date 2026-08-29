import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { getLocalDateKey } from '@/features/training/training-domain';
import { useTrainingData } from '@/features/training/training-queries';
import { ScheduleItemList } from '@/features/training/schedule-item-list';
import { getCurrentLocale } from '@/i18n';
import { opacity, spacing } from '@/theme';

const weekdays = [1, 2, 3, 4, 5, 6, 7] as const;

export function WeeklyScheduleScreen() {
  const { t } = useTranslation('training');
  const router = useRouter();
  const { profile, user } = useAuth();
  const training = useTrainingData(user?.id ?? '', profile?.locale ?? getCurrentLocale());

  return (
    <StackScrollScreen>
      <View style={{ gap: spacing.lg }}>
        <AppText color="textSecondary">{t('scheduleScreen.intro')}</AppText>
        <AppButton
          onPress={() =>
            router.push({
              pathname: '/training-tools/override',
              params: { date: getLocalDateKey() },
            })
          }
          title={t('scheduleScreen.todayOverride')}
          variant="secondary"
        />
      </View>

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
        <View style={{ gap: spacing.md }}>
          {weekdays.map((weekday) => {
            const dayItems = training.data.weeklySchedule.filter(
              (item) => item.weekday === weekday,
            );
            const dayName = t(`weekdays.${weekday}`);

            return (
              <Pressable
                accessibilityLabel={t('scheduleScreen.editDay', { day: dayName })}
                accessibilityRole="button"
                key={weekday}
                onPress={() => router.push(`/training-tools/schedule/${weekday}`)}
                style={({ pressed }) => ({ opacity: pressed ? opacity.pressed : 1 })}
              >
                <Card elevated style={{ gap: spacing.md }}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="title">{dayName}</AppText>
                      <AppText color="textMuted" variant="caption">
                        {dayItems.length === 0
                          ? t('scheduleScreen.emptyDay')
                          : t('scheduleScreen.itemCount', { count: dayItems.length })}
                      </AppText>
                    </View>
                    <AppText color="textMuted" variant="title">
                      ›
                    </AppText>
                  </View>
                  <ScheduleItemList
                    activities={training.data.activities}
                    emptyLabel={t('scheduleScreen.emptyDay')}
                    items={dayItems}
                    plans={training.data.plans}
                  />
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
    </StackScrollScreen>
  );
}
