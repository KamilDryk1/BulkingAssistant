import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { FormScreen } from '@/components/form-screen';
import { useAuth } from '@/features/auth/auth-context';
import { signOut } from '@/features/auth/auth-service';
import { spacing } from '@/theme';

export function SessionErrorScreen() {
  const { t } = useTranslation(['settings', 'auth']);
  const { refreshProfile } = useAuth();
  const logout = useMutation({ mutationFn: signOut });

  return (
    <FormScreen
      detail={t('profileError', { ns: 'settings' })}
      eyebrow={t('signIn.eyebrow', { ns: 'auth' })}
      title={t('profile', { ns: 'settings' })}
    >
      <Card elevated style={{ gap: spacing.lg }}>
        <AppText color="danger">{t('profileError', { ns: 'settings' })}</AppText>
        <AppButton onPress={() => void refreshProfile()} title={t('retry', { ns: 'settings' })} />
        <AppButton
          loading={logout.isPending}
          onPress={() => logout.mutate()}
          title={t('logout', { ns: 'settings' })}
          variant="ghost"
        />
      </Card>
    </FormScreen>
  );
}
