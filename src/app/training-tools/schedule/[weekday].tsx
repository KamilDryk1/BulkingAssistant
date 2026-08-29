import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ScheduleDayEditorScreen } from '@/screens/training/schedule-day-editor';

export default function ScheduleDayRoute() {
  const { t } = useTranslation('training');
  const { weekday: weekdayParam } = useLocalSearchParams<{ weekday: string }>();
  const parsedWeekday = Number(weekdayParam);
  const weekday = parsedWeekday >= 1 && parsedWeekday <= 7 ? parsedWeekday : 1;

  return (
    <>
      <Stack.Screen options={{ title: t(`weekdays.${weekday}`) }} />
      <ScheduleDayEditorScreen weekday={weekday} />
    </>
  );
}
