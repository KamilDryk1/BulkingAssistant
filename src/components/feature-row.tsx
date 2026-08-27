import { Pressable, View } from 'react-native';

import { colors, layout, opacity, radius, spacing } from '@/theme';

import { AppText } from './app-text';

type FeatureRowProps = {
  detail: string;
  marker: string;
  onPress?: () => void;
  title: string;
};

export function FeatureRow({ detail, marker, onPress, title }: FeatureRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: layout.minTouchTarget,
        opacity: pressed ? opacity.pressed : 1,
        paddingVertical: spacing.sm,
      })}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.surfaceSelected,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          height: layout.iconLarge,
          justifyContent: 'center',
          width: layout.iconLarge,
        }}
      >
        <AppText color="primary" variant="bodyStrong">
          {marker}
        </AppText>
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText color="textMuted" variant="caption">
          {detail}
        </AppText>
      </View>
      <AppText color="textMuted" variant="title">
        ›
      </AppText>
    </Pressable>
  );
}
