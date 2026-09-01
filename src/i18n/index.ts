import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import authEn from './en/auth.json';
import aiEn from './en/ai.json';
import bodyEn from './en/body.json';
import commonEn from './en/common.json';
import onboardingEn from './en/onboarding.json';
import profileEn from './en/profile.json';
import progressEn from './en/progress.json';
import settingsEn from './en/settings.json';
import todayEn from './en/today.json';
import trainingEn from './en/training.json';
import workoutEn from './en/workout.json';
import authPl from './pl/auth.json';
import aiPl from './pl/ai.json';
import bodyPl from './pl/body.json';
import commonPl from './pl/common.json';
import onboardingPl from './pl/onboarding.json';
import profilePl from './pl/profile.json';
import progressPl from './pl/progress.json';
import settingsPl from './pl/settings.json';
import todayPl from './pl/today.json';
import trainingPl from './pl/training.json';
import workoutPl from './pl/workout.json';

export const supportedLocales = ['en', 'pl'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

const localeStorageKey = 'bulking-assistant.locale';
const i18n = createInstance();

const resources = {
  en: {
    ai: aiEn,
    auth: authEn,
    body: bodyEn,
    common: commonEn,
    onboarding: onboardingEn,
    profile: profileEn,
    progress: progressEn,
    settings: settingsEn,
    today: todayEn,
    training: trainingEn,
    workout: workoutEn,
  },
  pl: {
    ai: aiPl,
    auth: authPl,
    body: bodyPl,
    common: commonPl,
    onboarding: onboardingPl,
    profile: profilePl,
    progress: progressPl,
    settings: settingsPl,
    today: todayPl,
    training: trainingPl,
    workout: workoutPl,
  },
} as const;

function resolveLocale(value: string | null | undefined): SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale) ? (value as SupportedLocale) : 'en';
}

let initialization: Promise<void> | null = null;

export function initializeI18n() {
  if (!initialization) {
    initialization = (async () => {
      let storedLocale: string | null = null;

      try {
        storedLocale = await AsyncStorage.getItem(localeStorageKey);
      } catch {
        // A storage failure should never prevent the app from starting in the fallback locale.
      }

      const deviceLocale = getLocales()[0]?.languageCode;
      const locale = resolveLocale(storedLocale ?? deviceLocale);

      await i18n.use(initReactI18next).init({
        defaultNS: 'common',
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
        lng: locale,
        resources,
        supportedLngs: supportedLocales,
      });
    })();
  }

  return initialization;
}

export async function setAppLocale(locale: SupportedLocale) {
  try {
    await AsyncStorage.setItem(localeStorageKey, locale);
  } catch {
    // Keep the in-memory preference usable even when device storage is unavailable.
  }
  await i18n.changeLanguage(locale);
}

export function getCurrentLocale(): SupportedLocale {
  return resolveLocale(i18n.resolvedLanguage ?? i18n.language);
}

export { i18n };
