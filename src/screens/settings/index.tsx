import { useMutation } from '@tanstack/react-query';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { ChoiceField } from '@/components/choice-field';
import { FeatureRow } from '@/components/feature-row';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { useAuth } from '@/features/auth/auth-context';
import { signOut } from '@/features/auth/auth-service';
import { useUpdateProfile } from '@/features/profile/profile-queries';
import { getCurrentLocale, setAppLocale, type SupportedLocale } from '@/i18n';
import type { WeightUnit } from '@/types/database';
import { spacing } from '@/theme';

type SettingsScreenProps = {
  onOpenProfile: () => void;
};

export function SettingsScreen({ onOpenProfile }: SettingsScreenProps) {
  const { t } = useTranslation('settings');
  const { profile, profileError, refreshProfile, user } = useAuth();
  const currentLocale = profile?.locale ?? getCurrentLocale();
  const updateProfile = useUpdateProfile(user?.id ?? 'missing-user');
  const logout = useMutation({ mutationFn: signOut });

  const selectLocale = (locale: SupportedLocale) => {
    if (locale === currentLocale) {
      return;
    }

    updateProfile.mutate({ locale }, { onSuccess: () => void setAppLocale(locale) });
  };

  const selectWeightUnit = (preferred_weight_unit: WeightUnit) => {
    if (preferred_weight_unit !== profile?.preferred_weight_unit) {
      updateProfile.mutate({ preferred_weight_unit });
    }
  };

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('language')} />
        <Card style={{ gap: spacing.lg }}>
          <AppText color="textMuted" variant="caption">
            {t('languageDetail')}
          </AppText>
          <ChoiceField
            label={t('language')}
            onChange={selectLocale}
            options={[
              { label: t('english'), value: 'en' },
              { label: t('polish'), value: 'pl' },
            ]}
            value={currentLocale}
          />
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('units')} />
        <Card style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="bodyStrong">{t('weightUnit')}</AppText>
            <AppText color="textMuted" variant="caption">
              {t('unitsDetail')}
            </AppText>
          </View>
          <ChoiceField
            label={t('weightUnit')}
            onChange={selectWeightUnit}
            options={[
              { label: t('kilograms'), value: 'kg' },
              { label: t('pounds'), value: 'lb' },
            ]}
            value={profile?.preferred_weight_unit ?? 'kg'}
          />
        </Card>
      </View>

      {profileError ? (
        <Card elevated style={{ gap: spacing.md }}>
          <AppText color="danger" variant="bodyStrong">
            {t('profileError')}
          </AppText>
          <AppButton onPress={() => void refreshProfile()} title={t('retry')} variant="secondary" />
        </Card>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('profile')} />
        <Card>
          <FeatureRow
            detail={t('profileDetail')}
            marker="01"
            onPress={onOpenProfile}
            title={t('profile')}
          />
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('account')} />
        <Card style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="bodyStrong">{t('account')}</AppText>
            <AppText color="textMuted" variant="caption">
              {user?.email ? t('accountDetail', { email: user.email }) : t('accountDetailUnknown')}
            </AppText>
          </View>
          <AppButton
            loading={logout.isPending}
            onPress={() => logout.mutate()}
            title={t('logout')}
            variant="secondary"
          />
        </Card>
      </View>

      {updateProfile.isPending ? (
        <AppText color="textMuted" variant="caption">
          {t('saving')}
        </AppText>
      ) : null}
      {updateProfile.isError ? (
        <AppText color="danger" variant="caption">
          {t('preferenceError')}
        </AppText>
      ) : null}
    </Screen>
  );
}
