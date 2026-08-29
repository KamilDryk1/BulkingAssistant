import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { FormScreen } from '@/components/form-screen';
import { useAuth } from '@/features/auth/auth-context';
import { PersonalDetailsFields } from '@/features/profile/personal-details-fields';
import { profileSchema, type ProfileValues } from '@/features/profile/profile-schemas';
import { useUpdateProfile } from '@/features/profile/profile-queries';
import { normalizeDecimalInput } from '@/features/units/weight';
import { spacing } from '@/theme';

type ProfileScreenProps = {
  onDone: () => void;
};

export function ProfileScreen({ onDone }: ProfileScreenProps) {
  const { t } = useTranslation('profile');
  const { profile, user } = useAuth();
  const updateProfile = useUpdateProfile(user?.id ?? 'missing-user');
  const form = useForm<ProfileValues>({
    defaultValues: {
      activityLevel: profile?.activity_level ?? 'moderate',
      dateOfBirth: profile?.date_of_birth ?? '',
      goal: profile?.goal ?? 'maintain',
      heightCm: profile?.height_cm?.toString() ?? '',
      sex: profile?.sex ?? 'male',
    },
    resolver: zodResolver(profileSchema),
  });

  const submit = form.handleSubmit((values) => {
    updateProfile.mutate(
      {
        activity_level: values.activityLevel,
        date_of_birth: values.dateOfBirth,
        goal: values.goal,
        height_cm: normalizeDecimalInput(values.heightCm),
        sex: values.sex,
      },
      { onSuccess: onDone },
    );
  });

  return (
    <FormScreen detail={t('detail')} eyebrow={t('eyebrow')} title={t('title')}>
      <FormProvider {...form}>
        <Card elevated style={{ gap: spacing.xl }}>
          <PersonalDetailsFields />
          {updateProfile.isError ? (
            <AppText color="danger" variant="caption">
              {t('error')}
            </AppText>
          ) : null}
          <AppButton loading={updateProfile.isPending} onPress={submit} title={t('save')} />
        </Card>
      </FormProvider>
      <AppButton onPress={onDone} title={t('cancel')} variant="ghost" />
    </FormScreen>
  );
}
