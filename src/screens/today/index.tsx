import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, radius, spacing } from '@/theme';
import { formatFullDate } from '@/utils/format-date';

function MacroPlaceholder({ label }: { label: string }) {
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <AppText adjustsFontSizeToFit numberOfLines={1} variant="label">
        {label}
      </AppText>
      <AppText color="textMuted" selectable variant="bodyStrong">
        —
      </AppText>
    </View>
  );
}

export function TodayScreen() {
  const { t } = useTranslation('today');
  const locale = getCurrentLocale();
  const dateLabel = useMemo(() => formatFullDate(new Date(), locale), [locale]);

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={dateLabel} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('nutritionTarget')} />
        <Card elevated padding="large" style={{ gap: spacing.xl }}>
          <View style={{ gap: spacing.sm }}>
            <AppText color="textMuted" variant="caption">
              {t('targetPending')}
            </AppText>
            <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm }}>
              <AppText color="primary" selectable variant="display">
                —
              </AppText>
              <AppText color="textMuted" variant="bodyStrong">
                {t('common:units.calories')}
              </AppText>
            </View>
          </View>

          <View
            style={{
              backgroundColor: colors.border,
              height: layout.borderWidth,
              width: '100%',
            }}
          />

          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <MacroPlaceholder label={t('protein')} />
            <MacroPlaceholder label={t('carbs')} />
            <MacroPlaceholder label={t('fat')} />
          </View>

          <AppButton disabled title={t('setUpProfile')} />
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('plannedTraining')} />
        <EmptyStateCard
          actionLabel={t('chooseWorkout')}
          detail={t('noWorkoutDetail')}
          title={t('noWorkout')}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('activities')} />
        <EmptyStateCard
          actionLabel={t('addActivity')}
          detail={t('noActivitiesDetail')}
          title={t('noActivities')}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('bodyWeight')} />
        <Card
          style={{
            backgroundColor: colors.surface,
            borderCurve: 'continuous',
            borderRadius: radius.lg,
            gap: spacing.lg,
          }}
        >
          <View style={{ gap: spacing.xs }}>
            <AppText variant="bodyStrong">{t('noWeight')}</AppText>
            <AppText color="textMuted" variant="caption">
              {t('noWeightDetail')}
            </AppText>
          </View>
          <AppButton disabled title={t('logWeight')} variant="secondary" />
        </Card>
      </View>
    </Screen>
  );
}
