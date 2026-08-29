import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { ChoiceField } from '@/components/choice-field';
import { FormTextField } from '@/components/form-text-field';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { getLocalDateKey } from '@/features/training/training-domain';
import { useTrainingData } from '@/features/training/training-queries';
import { activityLogSchema, type ActivityLogValues } from '@/features/today/today-schemas';
import { useSaveActivityLog } from '@/features/today/today-queries';
import { getCurrentLocale } from '@/i18n';
import { spacing } from '@/theme';

export function ActivityLogScreen() {
  const { t } = useTranslation('today');
  const router = useRouter();
  const { profile, user } = useAuth();
  const training = useTrainingData(user?.id ?? '', profile?.locale ?? getCurrentLocale());
  const saveActivity = useSaveActivityLog();
  const form = useForm<ActivityLogValues>({
    defaultValues: { activityId: '', durationMinutes: '', intensity: '' },
    resolver: zodResolver(activityLogSchema),
  });

  const submit = form.handleSubmit((values) => {
    const activity = training.data?.activities.find((item) => item.id === values.activityId);
    if (!activity || !user) {
      return;
    }

    saveActivity.mutate(
      {
        activityDate: getLocalDateKey(),
        activityDefinitionId: activity.id,
        activityName: activity.displayName,
        durationMinutes: values.durationMinutes.trim() ? Number(values.durationMinutes) : null,
        intensity: values.intensity || null,
        userId: user.id,
      },
      { onSuccess: () => router.back() },
    );
  });

  return (
    <StackScrollScreen>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">{t('activityForm.title')}</AppText>
        <AppText color="textSecondary">{t('activityForm.detail')}</AppText>
      </View>

      {training.isPending ? (
        <QueryStateCard
          detail={t('activityForm.loadingDetail')}
          title={t('activityForm.loadingTitle')}
        />
      ) : training.isError ? (
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={() => void training.refetch()}
          title={t('status.errorTitle')}
        />
      ) : (
        <Card elevated style={{ gap: spacing.xl }}>
          <Controller
            control={form.control}
            name="activityId"
            render={({ field, fieldState }) => (
              <ChoiceField
                columns={1}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                label={t('activityForm.activity')}
                onChange={field.onChange}
                options={training.data.activities.map((activity) => ({
                  label: activity.displayName,
                  value: activity.id,
                }))}
                value={field.value}
              />
            )}
          />
          <Controller
            control={form.control}
            name="durationMinutes"
            render={({ field, fieldState }) => (
              <FormTextField
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                keyboardType="number-pad"
                label={t('activityForm.duration')}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder={t('activityForm.durationPlaceholder')}
                value={field.value}
              />
            )}
          />
          <Controller
            control={form.control}
            name="intensity"
            render={({ field }) => (
              <ChoiceField
                label={t('activityForm.intensity')}
                onChange={field.onChange}
                options={[
                  { label: t('activityForm.unspecified'), value: '' },
                  { label: t('intensity.light'), value: 'light' },
                  { label: t('intensity.moderate'), value: 'moderate' },
                  { label: t('intensity.hard'), value: 'hard' },
                ]}
                value={field.value}
              />
            )}
          />
          {saveActivity.isError ? (
            <AppText color="danger" variant="caption">
              {t('activityForm.saveError')}
            </AppText>
          ) : null}
          <AppButton
            loading={saveActivity.isPending}
            onPress={submit}
            title={t('activityForm.save')}
          />
          <AppButton onPress={() => router.back()} title={t('actions.cancel')} variant="ghost" />
        </Card>
      )}
    </StackScrollScreen>
  );
}
