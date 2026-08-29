import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, opacity, radius, spacing } from '@/theme';

import { AppText } from './app-text';

type CompactActionProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function CompactAction({
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  selected = false,
  style,
}: CompactActionProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          backgroundColor: selected ? colors.primaryMuted : colors.surfaceElevated,
          borderColor: selected ? colors.primary : colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.sm,
          borderWidth: layout.borderWidth,
          justifyContent: 'center',
          minHeight: layout.minTouchTarget,
          minWidth: layout.minTouchTarget,
          opacity: disabled ? opacity.disabled : pressed ? opacity.pressed : 1,
          paddingHorizontal: spacing.md,
        },
        style,
      ]}
    >
      <AppText color={selected ? 'primary' : 'textSecondary'} variant="bodyStrong">
        {label}
      </AppText>
    </Pressable>
  );
}
