import {
  TabList,
  TabSlot,
  Tabs,
  TabTrigger,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, layout, opacity, radius, shadows, spacing } from '@/theme';

import { AppText } from './app-text';

export default function AppTabs() {
  const { t } = useTranslation('common');

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <WebTabList>
          <TabTrigger href="/" name="today" asChild>
            <WebTabButton marker="01">{t('tabs.today')}</WebTabButton>
          </TabTrigger>
          <TabTrigger href="/training" name="training" asChild>
            <WebTabButton marker="02">{t('tabs.training')}</WebTabButton>
          </TabTrigger>
          <TabTrigger href="/progress" name="progress" asChild>
            <WebTabButton marker="03">{t('tabs.progress')}</WebTabButton>
          </TabTrigger>
          <TabTrigger href="/body" name="body" asChild>
            <WebTabButton marker="04">{t('tabs.body')}</WebTabButton>
          </TabTrigger>
          <TabTrigger href="/settings" name="settings" asChild>
            <WebTabButton marker="05">{t('tabs.settings')}</WebTabButton>
          </TabTrigger>
        </WebTabList>
      </TabList>
    </Tabs>
  );
}

function WebTabButton({
  children,
  isFocused,
  marker,
  ...props
}: TabTriggerSlotProps & { children: ReactNode; marker: string }) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => ({
        alignItems: 'center',
        flex: 1,
        gap: spacing.xs,
        justifyContent: 'center',
        minHeight: layout.minTouchTarget,
        opacity: pressed ? opacity.pressed : 1,
        paddingHorizontal: spacing.xs,
      })}
    >
      <AppText color={isFocused ? 'primary' : 'textMuted'} variant="label">
        {marker}
      </AppText>
      <AppText color={isFocused ? 'primary' : 'textMuted'} variant="tab">
        {children}
      </AppText>
    </Pressable>
  );
}

function WebTabList({ children, ...props }: TabListProps) {
  return (
    <View
      {...props}
      style={{
        alignItems: 'center',
        bottom: spacing.lg,
        justifyContent: 'center',
        left: spacing.lg,
        pointerEvents: 'box-none',
        position: 'absolute',
        right: spacing.lg,
      }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.xl,
          borderWidth: layout.borderWidth,
          boxShadow: shadows.raised,
          flexDirection: 'row',
          maxWidth: layout.maxContentWidth,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          width: '100%',
        }}
      >
        {children}
      </View>
    </View>
  );
}
