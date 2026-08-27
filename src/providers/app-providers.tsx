import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme as NavigationDarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { queryClient } from '@/lib/query-client';
import { colors } from '@/theme';

const navigationTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: colors.background,
    border: colors.border,
    card: colors.surface,
    notification: colors.danger,
    primary: colors.primary,
    text: colors.textPrimary,
  },
};

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navigationTheme}>
        <View style={{ backgroundColor: colors.background, flex: 1 }}>{children}</View>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
