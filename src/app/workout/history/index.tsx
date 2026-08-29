import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { WorkoutHistoryScreen } from '@/screens/workout/workout-history';

export default function WorkoutHistoryRoute() {
  const { t } = useTranslation('workout');

  return (
    <>
      <Stack.Screen options={{ title: t('routes.history') }} />
      <WorkoutHistoryScreen />
    </>
  );
}
