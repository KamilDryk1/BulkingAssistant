import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CustomExerciseScreen } from '@/screens/training/custom-exercise';

export default function CustomExerciseRoute() {
  const { t } = useTranslation('training');
  const router = useRouter();
  const { addToPlan, initialName } = useLocalSearchParams<{
    addToPlan?: string;
    initialName?: string;
  }>();

  const finishCreation = (exerciseId: string) => {
    if (addToPlan === 'new') {
      router.dismissTo({
        pathname: '/training-tools/plans/new',
        params: { addedExerciseId: exerciseId },
      });
      return;
    }

    if (addToPlan) {
      router.dismissTo({
        pathname: '/training-tools/plans/[id]',
        params: { addedExerciseId: exerciseId, id: addToPlan },
      });
      return;
    }

    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: t('routes.newExercise') }} />
      <CustomExerciseScreen initialName={initialName} onCreated={finishCreation} />
    </>
  );
}
