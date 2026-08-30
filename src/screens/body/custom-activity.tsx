import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { FormTextField } from '@/components/form-text-field';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { useCreateCustomActivity } from '@/features/training/training-queries';
import {
  customActivitySchema,
  type CustomActivityFormValues,
} from '@/features/training/training-schemas';
import { spacing } from '@/theme';

export function CustomActivityScreen() {
  const { t } = useTranslation('body');
  const router = useRouter();
  const { user } = useAuth();
  const createActivity = useCreateCustomActivity();
  const form = useForm<CustomActivityFormValues>({
    defaultValues: { name: '' },
    resolver: zodResolver(customActivitySchema),
  });
  const submit = form.handleSubmit((values) => {
    if (!user) {
      return;
    }

    createActivity.mutate(
      { name: values.name, userId: user.id },
      { onSuccess: () => router.back() },
    );
  });

  return (
    <StackScrollScreen>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">{t('customActivity.title')}</AppText>
        <AppText color="textSecondary">{t('customActivity.detail')}</AppText>
      </View>
      <Card elevated style={{ gap: spacing.xl }}>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <FormTextField
              autoFocus
              error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              label={t('customActivity.name')}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder={t('customActivity.placeholder')}
              value={field.value}
            />
          )}
        />
        {createActivity.isError ? (
          <AppText color="danger" variant="caption">
            {t('customActivity.error')}
          </AppText>
        ) : null}
        <AppButton
          loading={createActivity.isPending}
          onPress={submit}
          title={t('customActivity.save')}
        />
        <AppButton onPress={() => router.back()} title={t('actions.cancel')} variant="ghost" />
      </Card>
    </StackScrollScreen>
  );
}
