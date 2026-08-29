import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { WeeklyScheduleScreen } from '@/screens/training/weekly-schedule';

export default function WeeklyScheduleRoute() {
  const { t } = useTranslation('training');

  return (
    <>
      <Stack.Screen options={{ title: t('routes.schedule') }} />
      <WeeklyScheduleScreen />
    </>
  );
}
