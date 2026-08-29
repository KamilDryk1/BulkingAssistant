import { useRouter } from 'expo-router';

import { SettingsScreen } from '@/screens/settings';

export default function SettingsRoute() {
  const router = useRouter();

  return <SettingsScreen onOpenProfile={() => router.push('/profile')} />;
}
