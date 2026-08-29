import {
  GoogleSansFlex_400Regular,
  GoogleSansFlex_500Medium,
  GoogleSansFlex_600SemiBold,
  GoogleSansFlex_700Bold,
  GoogleSansFlex_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/google-sans-flex';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { useAuth } from '@/features/auth/auth-context';
import { initializeI18n } from '@/i18n';
import { AppProviders } from '@/providers/app-providers';
import { SessionErrorScreen } from '@/screens/auth/session-error';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    GoogleSansFlex_400Regular,
    GoogleSansFlex_500Medium,
    GoogleSansFlex_600SemiBold,
    GoogleSansFlex_700Bold,
    GoogleSansFlex_800ExtraBold,
  });
  const [localizationReady, setLocalizationReady] = useState(false);

  useEffect(() => {
    void initializeI18n().finally(() => setLocalizationReady(true));
  }, []);

  const appReady = (fontsLoaded || Boolean(fontError)) && localizationReady;

  useEffect(() => {
    if (appReady) {
      void SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <AppProviders>
      <StatusBar style="light" />
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const { isLoading, profile, profileError, session } = useAuth();

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (session && profileError) {
    return <SessionErrorScreen />;
  }

  const onboardingComplete = Boolean(profile?.onboarding_completed_at);

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: 'GoogleSansFlex_600SemiBold' },
      }}
    >
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session) && !onboardingComplete}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session) && onboardingComplete}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
