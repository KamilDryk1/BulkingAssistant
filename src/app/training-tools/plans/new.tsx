import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { WorkoutPlanEditorScreen } from '@/screens/training/workout-plan-editor';

export default function NewWorkoutPlanRoute() {
  const { t } = useTranslation('training');

  return (
    <>
      <Stack.Screen options={{ title: t('routes.newPlan') }} />
      <WorkoutPlanEditorScreen planId={null} />
    </>
  );
}
