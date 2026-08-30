import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { WorkoutPlanEditorScreen } from '@/screens/training/workout-plan-editor';

export default function EditWorkoutPlanRoute() {
  const { t } = useTranslation('training');
  const { addedExerciseId, id } = useLocalSearchParams<{
    addedExerciseId?: string;
    id: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ title: t('routes.editPlan') }} />
      <WorkoutPlanEditorScreen addedExerciseId={addedExerciseId} planId={id ?? ''} />
    </>
  );
}
