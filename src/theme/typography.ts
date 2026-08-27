import type { TextStyle } from 'react-native';

import { colors } from './colors';

export const fontFamilies = {
  regular: 'GoogleSansFlex_400Regular',
  medium: 'GoogleSansFlex_500Medium',
  semibold: 'GoogleSansFlex_600SemiBold',
  bold: 'GoogleSansFlex_700Bold',
  extraBold: 'GoogleSansFlex_800ExtraBold',
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.bold,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -1.1,
    color: colors.textPrimary,
  },
  stat: {
    fontFamily: fontFamilies.bold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  heading: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 18,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyStrong: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  button: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.onPrimary,
  },
  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  tab: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
