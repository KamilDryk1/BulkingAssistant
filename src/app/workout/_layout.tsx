import { Stack } from 'expo-router/stack';

import { colors, fontFamilies } from '@/theme';

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: fontFamilies.semibold },
      }}
    />
  );
}
