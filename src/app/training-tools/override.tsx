import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { getLocalDateKey } from '@/features/training/training-domain';
import { DailyScheduleOverrideScreen } from '@/screens/training/daily-schedule-override';

export default function DailyScheduleOverrideRoute() {
  const { t } = useTranslation('training');
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getLocalDateKey();

  return (
    <>
      <Stack.Screen options={{ title: t('routes.todayOverride') }} />
      <DailyScheduleOverrideScreen date={date} />
    </>
  );
}
