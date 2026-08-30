import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ActivityHistoryScreen } from '@/screens/body/activity-history';

export default function ActivityHistoryRoute() {
  const { t } = useTranslation('body');

  return (
    <>
      <Stack.Screen options={{ title: t('activity.historyTitle') }} />
      <ActivityHistoryScreen />
    </>
  );
}
