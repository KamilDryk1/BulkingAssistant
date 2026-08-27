import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/app-header';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { FeatureRow } from '@/components/feature-row';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { colors, layout, spacing } from '@/theme';

const separatorStyle = {
  backgroundColor: colors.border,
  height: layout.borderWidth,
  width: '100%' as const,
};

export function TrainingScreen() {
  const { t } = useTranslation('training');

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('todayWorkout')} />
        <EmptyStateCard
          actionLabel={t('chooseWorkout')}
          detail={t('noPlanDetail')}
          title={t('noPlan')}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('library')} />
        <Card style={{ gap: spacing.xs }}>
          <FeatureRow detail={t('plansDetail')} marker="01" title={t('plans')} />
          <View style={separatorStyle} />
          <FeatureRow detail={t('exercisesDetail')} marker="02" title={t('exercises')} />
          <View style={separatorStyle} />
          <FeatureRow detail={t('scheduleDetail')} marker="03" title={t('schedule')} />
          <View style={separatorStyle} />
          <FeatureRow detail={t('historyDetail')} marker="04" title={t('history')} />
        </Card>
      </View>
    </Screen>
  );
}
