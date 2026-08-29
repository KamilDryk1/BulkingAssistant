import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { ChoiceField } from '@/components/choice-field';
import { FormScreen } from '@/components/form-screen';
import { FormTextField } from '@/components/form-text-field';
import { useAuth } from '@/features/auth/auth-context';
import { signOut } from '@/features/auth/auth-service';
import { PersonalDetailsFields } from '@/features/profile/personal-details-fields';
import { onboardingSchema, type OnboardingValues } from '@/features/profile/profile-schemas';
import { useCompleteOnboarding } from '@/features/profile/profile-queries';
import { normalizeDecimalInput, poundsToKilograms } from '@/features/units/weight';
import { getCurrentLocale } from '@/i18n';
import { spacing } from '@/theme';

export function OnboardingScreen() {
  const { t } = useTranslation(['onboarding', 'common', 'settings']);
  const { user } = useAuth();
  const completeProfile = useCompleteOnboarding(user?.id ?? 'missing-user');
  const logout = useMutation({ mutationFn: signOut });
  const form = useForm<OnboardingValues>({
    defaultValues: {
      activityLevel: 'moderate',
      dateOfBirth: '',
      goal: 'maintain',
      heightCm: '',
      initialWeight: '',
      locale: getCurrentLocale(),
      sex: 'male',
      weightUnit: 'kg',
    },
    resolver: zodResolver(onboardingSchema),
  });
  const weightUnit = useWatch({ control: form.control, name: 'weightUnit' });

  const submit = form.handleSubmit((values) => {
    const enteredWeight = normalizeDecimalInput(values.initialWeight);
    const initialWeightKg =
      values.weightUnit === 'lb' ? poundsToKilograms(enteredWeight) : enteredWeight;

    completeProfile.mutate({
      activityLevel: values.activityLevel,
      dateOfBirth: values.dateOfBirth,
      goal: values.goal,
      heightCm: normalizeDecimalInput(values.heightCm),
      initialWeightKg,
      locale: values.locale,
      sex: values.sex,
      weightUnit: values.weightUnit,
    });
  });

  return (
    <FormScreen
      detail={t('detail', { ns: 'onboarding' })}
      eyebrow={t('eyebrow', { ns: 'onboarding' })}
      title={t('title', { ns: 'onboarding' })}
    >
      <FormProvider {...form}>
        <Card elevated style={{ gap: spacing.xl }}>
          <Controller
            control={form.control}
            name="locale"
            render={({ field, fieldState }) => (
              <ChoiceField
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message, { ns: 'common' })
                    : undefined
                }
                label={t('language', { ns: 'onboarding' })}
                onChange={field.onChange}
                options={[
                  { label: t('english', { ns: 'settings' }), value: 'en' },
                  { label: t('polish', { ns: 'settings' }), value: 'pl' },
                ]}
                value={field.value}
              />
            )}
          />
          <Controller
            control={form.control}
            name="weightUnit"
            render={({ field, fieldState }) => (
              <ChoiceField
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message, { ns: 'common' })
                    : undefined
                }
                label={t('units', { ns: 'onboarding' })}
                onChange={field.onChange}
                options={[
                  { label: t('units.kilograms', { ns: 'common' }), value: 'kg' },
                  { label: t('units.pounds', { ns: 'common' }), value: 'lb' },
                ]}
                value={field.value}
              />
            )}
          />
          <PersonalDetailsFields />
          <Controller
            control={form.control}
            name="initialWeight"
            render={({ field, fieldState }) => (
              <FormTextField
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message, { ns: 'common' })
                    : undefined
                }
                keyboardType="decimal-pad"
                label={t('currentWeight', { ns: 'onboarding', unit: weightUnit })}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder={t('weightPlaceholder', { ns: 'onboarding' })}
                value={field.value}
              />
            )}
          />
          {completeProfile.isError ? (
            <AppText color="danger" variant="caption">
              {t('error', { ns: 'onboarding' })}
            </AppText>
          ) : null}
          <AppButton
            loading={completeProfile.isPending}
            onPress={submit}
            title={t('save', { ns: 'onboarding' })}
          />
        </Card>
      </FormProvider>
      <AppButton
        loading={logout.isPending}
        onPress={() => logout.mutate()}
        title={t('signOut', { ns: 'onboarding' })}
        variant="ghost"
      />
    </FormScreen>
  );
}
