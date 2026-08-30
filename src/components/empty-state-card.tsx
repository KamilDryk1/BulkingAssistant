import { View } from 'react-native';

import { colors, layout, radius, spacing } from '@/theme';

import { AppButton } from './app-button';
import { AppText } from './app-text';
import { Card } from './card';

type EmptyStateCardProps = {
  actionLabel?: string;
  detail: string;
  onAction?: () => void;
  title: string;
};

export function EmptyStateCard({ actionLabel, detail, onAction, title }: EmptyStateCardProps) {
  return (
    <Card elevated style={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            alignItems: 'center',
            backgroundColor: colors.primaryMuted,
            borderCurve: 'continuous',
            borderRadius: radius.md,
            height: layout.iconLarge,
            justifyContent: 'center',
            width: layout.iconLarge,
          }}
        >
          <AppText color="primary" variant="title">
            +
          </AppText>
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText color="textMuted" variant="caption">
            {detail}
          </AppText>
        </View>
      </View>
      {actionLabel ? (
        <AppButton onPress={onAction} title={actionLabel} variant="secondary" />
      ) : null}
    </Card>
  );
}
