import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import { colors, fontFamilies, typography } from '@/theme';

export default function AppTabs() {
  const { t } = useTranslation('common');

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      disableTransparentOnScrollEdge
      iconColor={{ default: colors.textMuted, selected: colors.primary }}
      indicatorColor={colors.primaryMuted}
      labelStyle={{
        default: {
          color: colors.textMuted,
          fontFamily: fontFamilies.medium,
          fontSize: typography.tab.fontSize,
        },
        selected: {
          color: colors.primary,
          fontFamily: fontFamilies.semibold,
          fontSize: typography.tab.fontSize,
        },
      }}
      minimizeBehavior="never"
      tintColor={colors.primary}
    >
      <NativeTabs.Trigger disableAutomaticContentInsets name="index">
        <NativeTabs.Trigger.Label>{t('tabs.today')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="calendar_today" sf="calendar" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger disableAutomaticContentInsets name="training">
        <NativeTabs.Trigger.Label>{t('tabs.training')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="fitness_center" sf="dumbbell" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger disableAutomaticContentInsets name="progress">
        <NativeTabs.Trigger.Label>{t('tabs.progress')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="show_chart" sf="chart.line.uptrend.xyaxis" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger disableAutomaticContentInsets name="body">
        <NativeTabs.Trigger.Label>{t('tabs.body')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="monitor_weight" sf="figure" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger disableAutomaticContentInsets name="settings">
        <NativeTabs.Trigger.Label>{t('tabs.settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="settings" sf="gearshape" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
