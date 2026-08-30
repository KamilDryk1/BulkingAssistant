import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { FormTextField } from '@/components/form-text-field';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { useTodayData, useSaveTodayWeight } from '@/features/today/today-queries';
import { weightLogSchema, type WeightLogValues } from '@/features/today/today-schemas';
import {
  formatBodyWeight,
  normalizeDecimalInput,
  poundsToKilograms,
} from '@/features/units/weight';
import { getLocalDateKey } from '@/features/training/training-domain';
import { spacing } from '@/theme';

export function WeightLogScreen() {
  const { t } = useTranslation(['today', 'common']);
  const { profile, user } = useAuth();
  const date = getLocalDateKey();
  const today = useTodayData(user?.id ?? '', date, profile);

  if (today.isPending) {
    return (
      <StackScrollScreen>
        <QueryStateCard
          detail={t('status.loadingDetail', { ns: 'today' })}
          title={t('status.loadingTitle', { ns: 'today' })}
        />
      </StackScrollScreen>
    );
  }

  if (today.isError || !today.data || !profile || !user) {
    return (
      <StackScrollScreen>
        <QueryStateCard
          actionLabel={t('status.retry', { ns: 'today' })}
          detail={t('status.errorDetail', { ns: 'today' })}
          onAction={() => void today.refetch()}
          title={t('status.errorTitle', { ns: 'today' })}
        />
      </StackScrollScreen>
    );
  }

  return (
    <WeightLogForm
      existingLogId={today.data.todayWeight?.id ?? null}
      initialWeightKg={today.data.todayWeight?.weight_kg ?? null}
      unit={profile.preferred_weight_unit}
      userId={user.id}
    />
  );
}

type WeightLogFormProps = {
  existingLogId: string | null;
  initialWeightKg: number | null;
  unit: 'kg' | 'lb';
  userId: string;
};

function WeightLogForm({ existingLogId, initialWeightKg, unit, userId }: WeightLogFormProps) {
  const { t } = useTranslation(['today', 'common']);
  const router = useRouter();
  const saveWeight = useSaveTodayWeight();
  const form = useForm<WeightLogValues>({
    defaultValues: {
      weight: initialWeightKg === null ? '' : formatBodyWeight(initialWeightKg, unit),
    },
    resolver: zodResolver(weightLogSchema),
  });
  const unitLabel = t(unit === 'lb' ? 'units.pounds' : 'units.kilograms', { ns: 'common' });
  const submit = form.handleSubmit((values) => {
    const displayWeight = normalizeDecimalInput(values.weight);
    const weightKg = unit === 'lb' ? poundsToKilograms(displayWeight) : displayWeight;

    if (weightKg < 20 || weightKg > 500) {
      form.setError('weight', { message: 'validation.weightRange' });
      return;
    }

    saveWeight.mutate({ existingLogId, userId, weightKg }, { onSuccess: () => router.back() });
  });

  return (
    <StackScrollScreen>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">
          {t(existingLogId ? 'weightForm.editTitle' : 'weightForm.title', { ns: 'today' })}
        </AppText>
        <AppText color="textSecondary">{t('weightForm.detail', { ns: 'today' })}</AppText>
      </View>
      <Card elevated style={{ gap: spacing.xl }}>
        <Controller
          control={form.control}
          name="weight"
          render={({ field, fieldState }) => (
            <FormTextField
              autoFocus
              error={
                fieldState.error?.message ? t(fieldState.error.message, { ns: 'today' }) : undefined
              }
              keyboardType="decimal-pad"
              label={t('weightForm.weight', { ns: 'today', unit: unitLabel })}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder={t('weightForm.placeholder', { ns: 'today' })}
              selectTextOnFocus
              value={field.value}
            />
          )}
        />
        {saveWeight.isError ? (
          <AppText color="danger" variant="caption">
            {t('weightForm.saveError', { ns: 'today' })}
          </AppText>
        ) : null}
        <AppButton
          loading={saveWeight.isPending}
          onPress={submit}
          title={t('weightForm.save', { ns: 'today' })}
        />
        <AppButton
          onPress={() => router.back()}
          title={t('actions.cancel', { ns: 'today' })}
          variant="ghost"
        />
      </Card>
    </StackScrollScreen>
  );
}
