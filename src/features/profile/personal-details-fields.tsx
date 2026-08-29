import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ChoiceField } from '@/components/choice-field';
import { FormTextField } from '@/components/form-text-field';

import type { ProfileValues } from './profile-schemas';

export function PersonalDetailsFields() {
  const { t } = useTranslation(['onboarding', 'common']);
  const { control } = useFormContext<ProfileValues>();

  return (
    <>
      <Controller
        control={control}
        name="sex"
        render={({ field, fieldState }) => (
          <ChoiceField
            error={
              fieldState.error?.message ? t(fieldState.error.message, { ns: 'common' }) : undefined
            }
            label={t('sex', { ns: 'onboarding' })}
            onChange={field.onChange}
            options={[
              { label: t('male', { ns: 'onboarding' }), value: 'male' },
              { label: t('female', { ns: 'onboarding' }), value: 'female' },
            ]}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="dateOfBirth"
        render={({ field, fieldState }) => (
          <FormTextField
            autoComplete="birthdate-full"
            error={
              fieldState.error?.message ? t(fieldState.error.message, { ns: 'common' }) : undefined
            }
            label={t('dateOfBirth', { ns: 'onboarding' })}
            maxLength={10}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder={t('datePlaceholder', { ns: 'onboarding' })}
            textContentType="birthdate"
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="heightCm"
        render={({ field, fieldState }) => (
          <FormTextField
            error={
              fieldState.error?.message ? t(fieldState.error.message, { ns: 'common' }) : undefined
            }
            keyboardType="decimal-pad"
            label={t('height', { ns: 'onboarding' })}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder={t('heightPlaceholder', { ns: 'onboarding' })}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="activityLevel"
        render={({ field, fieldState }) => (
          <ChoiceField
            columns={1}
            error={
              fieldState.error?.message ? t(fieldState.error.message, { ns: 'common' }) : undefined
            }
            label={t('activityLevel', { ns: 'onboarding' })}
            onChange={field.onChange}
            options={[
              {
                label: t('activity.sedentary', { ns: 'onboarding' }),
                value: 'sedentary',
              },
              { label: t('activity.light', { ns: 'onboarding' }), value: 'light' },
              {
                label: t('activity.moderate', { ns: 'onboarding' }),
                value: 'moderate',
              },
              {
                label: t('activity.very_active', { ns: 'onboarding' }),
                value: 'very_active',
              },
              {
                label: t('activity.extremely_active', { ns: 'onboarding' }),
                value: 'extremely_active',
              },
            ]}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="goal"
        render={({ field, fieldState }) => (
          <ChoiceField
            error={
              fieldState.error?.message ? t(fieldState.error.message, { ns: 'common' }) : undefined
            }
            label={t('goal', { ns: 'onboarding' })}
            onChange={field.onChange}
            options={[
              { label: t('goals.cut', { ns: 'onboarding' }), value: 'cut' },
              { label: t('goals.maintain', { ns: 'onboarding' }), value: 'maintain' },
              { label: t('goals.gain', { ns: 'onboarding' }), value: 'gain' },
            ]}
            value={field.value}
          />
        )}
      />
    </>
  );
}
