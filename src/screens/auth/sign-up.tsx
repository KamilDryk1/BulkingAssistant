import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { FormScreen } from '@/components/form-screen';
import { FormTextField } from '@/components/form-text-field';
import { useAuth } from '@/features/auth/auth-context';
import { signUpSchema, type SignUpValues } from '@/features/auth/auth-schemas';
import { signUpWithPassword } from '@/features/auth/auth-service';
import { getCurrentLocale } from '@/i18n';
import { colors, spacing } from '@/theme';

type SignUpScreenProps = {
  onBackToSignIn: () => void;
};

export function SignUpScreen({ onBackToSignIn }: SignUpScreenProps) {
  const { t } = useTranslation(['auth', 'common']);
  const { configured } = useAuth();
  const signUp = useMutation({
    mutationFn: ({ email, password }: SignUpValues) =>
      signUpWithPassword(email, password, getCurrentLocale()),
  });
  const { control, handleSubmit } = useForm<SignUpValues>({
    defaultValues: { confirmPassword: '', email: '', password: '' },
    resolver: zodResolver(signUpSchema),
  });
  const confirmationEmail = signUp.data?.session ? null : signUp.data?.user?.email;

  if (confirmationEmail) {
    return (
      <FormScreen
        detail={t('signUp.checkEmailDetail', { email: confirmationEmail, ns: 'auth' })}
        eyebrow={t('signUp.eyebrow', { ns: 'auth' })}
        title={t('signUp.checkEmailTitle', { ns: 'auth' })}
      >
        <Card
          elevated
          style={{
            backgroundColor: colors.primaryMuted,
            borderColor: colors.primaryMuted,
            gap: spacing.lg,
          }}
        >
          <AppText color="primary" variant="title">
            {confirmationEmail}
          </AppText>
          <AppButton onPress={onBackToSignIn} title={t('signUp.confirmedAction', { ns: 'auth' })} />
        </Card>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      detail={t('signUp.detail', { ns: 'auth' })}
      eyebrow={t('signUp.eyebrow', { ns: 'auth' })}
      title={t('signUp.title', { ns: 'auth' })}
    >
      {!configured ? (
        <Card
          elevated
          style={{
            backgroundColor: colors.primaryMuted,
            borderColor: colors.primaryMuted,
            gap: spacing.sm,
          }}
        >
          <AppText color="primary" variant="label">
            {t('configuration.label', { ns: 'auth' })}
          </AppText>
          <AppText variant="title">{t('configuration.title', { ns: 'auth' })}</AppText>
          <AppText color="textSecondary">{t('configuration.detail', { ns: 'auth' })}</AppText>
        </Card>
      ) : (
        <Card elevated style={{ gap: spacing.lg }}>
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <FormTextField
                autoCapitalize="none"
                autoComplete="email"
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message, { ns: 'common' })
                    : undefined
                }
                keyboardType="email-address"
                label={t('fields.email', { ns: 'auth' })}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder={t('fields.emailPlaceholder', { ns: 'auth' })}
                textContentType="emailAddress"
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <FormTextField
                autoCapitalize="none"
                autoComplete="new-password"
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message, { ns: 'common' })
                    : undefined
                }
                label={t('fields.password', { ns: 'auth' })}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder={t('fields.passwordPlaceholder', { ns: 'auth' })}
                secureTextEntry
                textContentType="newPassword"
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <FormTextField
                autoCapitalize="none"
                autoComplete="new-password"
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message, { ns: 'common' })
                    : undefined
                }
                label={t('fields.confirmPassword', { ns: 'auth' })}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                secureTextEntry
                textContentType="newPassword"
                value={field.value}
              />
            )}
          />
          {signUp.isError ? (
            <AppText color="danger" variant="caption">
              {t('errors.signUp', { ns: 'auth' })}
            </AppText>
          ) : null}
          <AppButton
            loading={signUp.isPending}
            onPress={handleSubmit((values) => signUp.mutate(values))}
            title={t('signUp.action', { ns: 'auth' })}
          />
        </Card>
      )}

      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <AppText color="textMuted">{t('signUp.hasAccount', { ns: 'auth' })}</AppText>
        <AppButton
          onPress={onBackToSignIn}
          title={t('signUp.backToSignIn', { ns: 'auth' })}
          variant="ghost"
        />
      </View>
    </FormScreen>
  );
}
