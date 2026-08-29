import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CustomExerciseScreen } from '@/screens/training/custom-exercise';

export default function CustomExerciseRoute() {
  const { t } = useTranslation('training');

  return (
    <>
      <Stack.Screen options={{ title: t('routes.newExercise') }} />
      <CustomExerciseScreen />
    </>
  );
}
