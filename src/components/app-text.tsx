import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { colors, typography, type ThemeColor, type TypographyVariant } from '@/theme';

type AppTextProps = ComponentProps<typeof Text> & {
  color?: ThemeColor;
  variant?: TypographyVariant;
};

export function AppText({ color, style, variant = 'body', ...props }: AppTextProps) {
  return (
    <Text
      {...props}
      style={[typography[variant], color ? { color: colors[color] } : undefined, style]}
    />
  );
}
