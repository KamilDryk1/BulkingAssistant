import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { colors, layout, opacity, radius, spacing } from '@/theme';

type ProgressMode = 'estimatedOneRepMax' | 'bestSet';

function ModeButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: selected ? colors.surfaceSelected : colors.transparent,
        borderCurve: 'continuous',
        borderRadius: radius.sm,
        flex: 1,
        justifyContent: 'center',
        minHeight: layout.minTouchTarget,
        opacity: pressed ? opacity.pressed : 1,
        paddingHorizontal: spacing.md,
      })}
    >
      <AppText color={selected ? 'textPrimary' : 'textMuted'} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

export function ProgressScreen() {
  const { t } = useTranslation('progress');
  const [mode, setMode] = useState<ProgressMode>('estimatedOneRepMax');

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('exercise')} />
        <EmptyStateCard detail={t('chooseExerciseDetail')} title={t('chooseExercise')} />
      </View>

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
        <ModeButton
          label={t('estimatedOneRepMax')}
          onPress={() => setMode('estimatedOneRepMax')}
          selected={mode === 'estimatedOneRepMax'}
        />
        <ModeButton
          label={t('bestSet')}
          onPress={() => setMode('bestSet')}
          selected={mode === 'bestSet'}
        />
      </View>

      <Card elevated padding="large" style={{ gap: spacing.xxl }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">{t('current')}</AppText>
          <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm }}>
            <AppText color="textMuted" selectable variant="stat">
              —
            </AppText>
            <AppText color="textMuted" variant="caption">
              {t('common:units.kilograms')}
            </AppText>
          </View>
        </View>
        <View
          style={{
            alignItems: 'center',
            borderColor: colors.border,
            borderCurve: 'continuous',
            borderRadius: radius.md,
            borderStyle: 'dashed',
            borderWidth: layout.borderWidth,
            gap: spacing.sm,
            justifyContent: 'center',
            minHeight: layout.emptyChartHeight,
            padding: spacing.xxl,
          }}
        >
          <AppText variant="bodyStrong">{t('noData')}</AppText>
          <AppText color="textMuted" style={{ textAlign: 'center' }} variant="caption">
            {t('noDataDetail')}
          </AppText>
        </View>
      </Card>
    </Screen>
  );
}
