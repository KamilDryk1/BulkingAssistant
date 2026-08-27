import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { colors, layout, radius, shadows, spacing } from '@/theme';

type CardProps = ComponentProps<typeof View> & {
  elevated?: boolean;
  padding?: 'default' | 'large' | 'none';
};

const cardPadding = {
  default: layout.cardPadding,
  large: layout.cardPaddingLarge,
  none: spacing.none,
} as const;

export function Card({ elevated = false, padding = 'default', style, ...props }: CardProps) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.lg,
          borderWidth: layout.borderWidth,
          boxShadow: elevated ? shadows.raised : shadows.card,
          padding: cardPadding[padding],
        },
        style,
      ]}
    />
  );
}
