import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ActiveWorkoutScreen } from '@/screens/workout/active-workout';

export default function ActiveWorkoutRoute() {
  const { t } = useTranslation('workout');
  const params = useLocalSearchParams<{ 'session-id': string }>();
  const sessionId = Array.isArray(params['session-id'])
    ? params['session-id'][0]
    : params['session-id'];

  return (
    <>
      <Stack.Screen options={{ title: t('routes.active') }} />
      <ActiveWorkoutScreen sessionId={sessionId ?? ''} />
    </>
  );
}
