import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { FeatureRow } from '@/components/feature-row';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { getCurrentLocale, setAppLocale, type SupportedLocale } from '@/i18n';
import { colors, layout, opacity, radius, spacing } from '@/theme';

function ChoiceButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress?: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress, selected }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: selected ? colors.primary : colors.surfaceElevated,
        borderColor: selected ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.md,
        borderWidth: layout.borderWidth,
        flex: 1,
        justifyContent: 'center',
        minHeight: layout.minTouchTarget,
        opacity: pressed ? opacity.pressed : 1,
        paddingHorizontal: spacing.sm,
      })}
    >
      <AppText color={selected ? 'onPrimary' : 'textSecondary'} variant="bodyStrong">
        {label}
      </AppText>
    </Pressable>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation('settings');
  const currentLocale = getCurrentLocale();
  const selectLocale = (locale: SupportedLocale) => void setAppLocale(locale);

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('language')} />
        <Card style={{ gap: spacing.lg }}>
          <AppText color="textMuted" variant="caption">
            {t('languageDetail')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <ChoiceButton
              label={t('english')}
              onPress={() => selectLocale('en')}
              selected={currentLocale === 'en'}
            />
            <ChoiceButton
              label={t('polish')}
              onPress={() => selectLocale('pl')}
              selected={currentLocale === 'pl'}
            />
          </View>
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('units')} />
        <Card style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="bodyStrong">{t('weightUnit')}</AppText>
            <AppText color="textMuted" variant="caption">
              {t('comingWithProfile')}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <ChoiceButton label={t('kilograms')} selected />
            <ChoiceButton label={t('pounds')} selected={false} />
          </View>
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('profile')} />
        <Card style={{ gap: spacing.sm }}>
          <FeatureRow detail={t('profileDetail')} marker="01" title={t('profile')} />
          <View style={{ backgroundColor: colors.border, height: layout.borderWidth }} />
          <FeatureRow detail={t('accountDetail')} marker="02" title={t('account')} />
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('foundation')} />
        <Card
          style={{
            backgroundColor: colors.primaryMuted,
            borderColor: colors.primaryMuted,
            gap: spacing.sm,
          }}
        >
          <AppText color="primary" variant="bodyStrong">
            {t('foundation')}
          </AppText>
          <AppText color="textSecondary" variant="caption">
            {t('foundationReady')}
          </AppText>
        </Card>
      </View>
    </Screen>
  );
}
