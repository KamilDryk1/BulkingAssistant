import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, layout, radius, spacing } from '@/theme';

import { AppText } from './app-text';

type AppHeaderProps = {
  eyebrow?: string;
  title?: string;
};

export function AppHeader({ eyebrow, title }: AppHeaderProps) {
  const { t } = useTranslation('common');

  return (
    <View style={{ gap: spacing.xxl }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.primary,
            borderCurve: 'continuous',
            borderRadius: radius.full,
            height: layout.iconLarge,
            justifyContent: 'center',
            width: layout.iconLarge,
          }}
        >
          <AppText color="onPrimary" variant="bodyStrong">
            BA
          </AppText>
        </View>
        <AppText color="primary" style={{ flex: 1 }} variant="title">
          {t('brandName')}
        </AppText>
        <View
          accessibilityElementsHidden
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.full,
            height: spacing.sm,
            width: spacing.sm,
          }}
        />
      </View>

      {title ? (
        <View style={{ gap: spacing.xs }}>
          {eyebrow ? <AppText variant="label">{eyebrow}</AppText> : null}
          <AppText variant="heading">{title}</AppText>
        </View>
      ) : null}
    </View>
  );
}
