import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ExerciseLibraryScreen } from '@/screens/training/exercise-library';

export default function ExerciseLibraryRoute() {
  const { t } = useTranslation('training');

  return (
    <>
      <Stack.Screen options={{ title: t('routes.exercises') }} />
      <ExerciseLibraryScreen />
    </>
  );
}
