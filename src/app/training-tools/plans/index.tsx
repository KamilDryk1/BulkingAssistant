import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { WorkoutPlansScreen } from '@/screens/training/workout-plans';

export default function WorkoutPlansRoute() {
  const { t } = useTranslation('training');

  return (
    <>
      <Stack.Screen options={{ title: t('routes.plans') }} />
      <WorkoutPlansScreen />
    </>
  );
}
