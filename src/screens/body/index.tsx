import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { colors, radius, spacing } from '@/theme';

export function BodyScreen() {
  const { t } = useTranslation('body');

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('goal')} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderCurve: 'continuous',
            borderRadius: radius.md,
            flexDirection: 'row',
            gap: spacing.xs,
            padding: spacing.xs,
          }}
        >
          {[t('cut'), t('maintain'), t('gain')].map((label, index) => (
            <View
              key={label}
              style={{
                alignItems: 'center',
                backgroundColor: index === 1 ? colors.surfaceSelected : colors.transparent,
                borderCurve: 'continuous',
                borderRadius: radius.sm,
                flex: 1,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.md,
              }}
            >
              <AppText color={index === 1 ? 'textPrimary' : 'textMuted'} variant="caption">
                {label}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('nutrition')} />
        <Card elevated padding="large" style={{ gap: spacing.xl }}>
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
            <AppText color="textMuted" selectable variant="stat">
              —
            </AppText>
            <AppText color="textMuted" style={{ textAlign: 'center' }} variant="caption">
              {t('nutritionDetail')}
            </AppText>
          </View>
          <AppButton disabled title={t('profileAction')} />
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('weight')} />
        <EmptyStateCard
          actionLabel={t('logWeight')}
          detail={t('weightDetail')}
          title={t('common:status.notConfigured')}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('activity')} />
        <EmptyStateCard detail={t('activityEmptyDetail')} title={t('activityEmpty')} />
      </View>
    </Screen>
  );
}
