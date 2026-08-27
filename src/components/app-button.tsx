import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, opacity, radius, spacing } from '@/theme';

import { AppText } from './app-text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const variants = {
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    textColor: 'onPrimary' as const,
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    textColor: 'textPrimary' as const,
  },
  ghost: {
    backgroundColor: colors.transparent,
    borderColor: colors.border,
    textColor: 'textSecondary' as const,
  },
} as const;

type AppButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
  variant?: ButtonVariant;
};

export function AppButton({
  accessibilityLabel,
  disabled = false,
  loading = false,
  onPress,
  style,
  title,
  variant = 'primary',
}: AppButtonProps) {
  const treatment = variants[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          backgroundColor: treatment.backgroundColor,
          borderColor: treatment.borderColor,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: layout.borderWidth,
          height: layout.buttonHeight,
          justifyContent: 'center',
          opacity: inactive ? opacity.disabled : pressed ? opacity.pressed : 1,
          paddingHorizontal: spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[treatment.textColor]} />
      ) : (
        <AppText color={treatment.textColor} variant="button">
          {title}
        </AppText>
      )}
    </Pressable>
  );
}
