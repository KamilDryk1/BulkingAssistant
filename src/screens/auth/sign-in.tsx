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
import { signInSchema, type SignInValues } from '@/features/auth/auth-schemas';
import { signInWithPassword } from '@/features/auth/auth-service';
import { colors, spacing } from '@/theme';

type SignInScreenProps = {
  onCreateAccount: () => void;
};

export function SignInScreen({ onCreateAccount }: SignInScreenProps) {
  const { t } = useTranslation(['auth', 'common']);
  const { configured } = useAuth();
  const signIn = useMutation({
    mutationFn: ({ email, password }: SignInValues) => signInWithPassword(email, password),
  });
  const { control, handleSubmit } = useForm<SignInValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(signInSchema),
  });

  return (
    <FormScreen
      detail={t('signIn.detail', { ns: 'auth' })}
      eyebrow={t('signIn.eyebrow', { ns: 'auth' })}
      title={t('signIn.title', { ns: 'auth' })}
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
                autoComplete="current-password"
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
                textContentType="password"
                value={field.value}
              />
            )}
          />
          {signIn.isError ? (
            <AppText color="danger" variant="caption">
              {t('errors.signIn', { ns: 'auth' })}
            </AppText>
          ) : null}
          <AppButton
            loading={signIn.isPending}
            onPress={handleSubmit((values) => signIn.mutate(values))}
            title={t('signIn.action', { ns: 'auth' })}
          />
        </Card>
      )}

      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <AppText color="textMuted">{t('signIn.noAccount', { ns: 'auth' })}</AppText>
        <AppButton
          onPress={onCreateAccount}
          title={t('signIn.createAccount', { ns: 'auth' })}
          variant="ghost"
        />
      </View>
    </FormScreen>
  );
}
