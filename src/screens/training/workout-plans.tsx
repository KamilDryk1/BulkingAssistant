import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import { useAuth } from '@/features/auth/auth-context';
import { useDeleteWorkoutPlan, useTrainingData } from '@/features/training/training-queries';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, opacity, spacing } from '@/theme';

export function WorkoutPlansScreen() {
  const { t } = useTranslation('training');
  const router = useRouter();
  const { profile, user } = useAuth();
  const training = useTrainingData(user?.id ?? '', profile?.locale ?? getCurrentLocale());
  const deletePlan = useDeleteWorkoutPlan();

  const confirmDelete = (planId: string) => {
    Alert.alert(t('plansScreen.deleteTitle'), t('plansScreen.deleteDetail'), [
      { style: 'cancel', text: t('actions.cancel') },
      {
        onPress: () => deletePlan.mutate(planId),
        style: 'destructive',
        text: t('actions.delete'),
      },
    ]);
  };

  return (
    <StackScrollScreen>
      <View style={{ gap: spacing.lg }}>
        <AppText color="textSecondary">{t('plansScreen.intro')}</AppText>
        <AppButton
          onPress={() => router.push('/training-tools/plans/new')}
          title={t('plansScreen.create')}
        />
      </View>

      {training.isPending ? (
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      ) : training.isError ? (
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={() => void training.refetch()}
          title={t('status.errorTitle')}
        />
      ) : training.data.plans.length === 0 ? (
        <EmptyStateCard
          actionLabel={t('plansScreen.create')}
          detail={t('plansScreen.emptyDetail')}
          onAction={() => router.push('/training-tools/plans/new')}
          title={t('plansScreen.emptyTitle')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {training.data.plans.map((plan) => (
            <Card elevated key={plan.id} style={{ gap: spacing.md }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/training-tools/plans/${plan.id}`)}
                style={({ pressed }) => ({
                  gap: spacing.md,
                  opacity: pressed ? opacity.pressed : 1,
                })}
              >
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <AppText variant="title">{plan.name}</AppText>
                    <AppText color="textMuted" variant="caption">
                      {t('plansScreen.exerciseCount', { count: plan.exercises.length })}
                    </AppText>
                  </View>
                  <AppText color="textMuted" variant="title">
                    ›
                  </AppText>
                </View>
                {plan.exercises.length > 0 ? (
                  <View
                    style={{
                      borderTopColor: colors.border,
                      borderTopWidth: layout.borderWidth,
                      gap: spacing.xs,
                      paddingTop: spacing.md,
                    }}
                  >
                    {plan.exercises.slice(0, 3).map((item, index) => (
                      <AppText color="textSecondary" key={item.id} variant="caption">
                        {index + 1}. {item.exercise.displayName}
                      </AppText>
                    ))}
                  </View>
                ) : null}
              </Pressable>
              <AppButton
                disabled={deletePlan.isPending}
                onPress={() => confirmDelete(plan.id)}
                title={t('actions.delete')}
                variant="ghost"
              />
            </Card>
          ))}
          {deletePlan.isError ? (
            <AppText color="danger" variant="caption">
              {t('plansScreen.deleteError')}
            </AppText>
          ) : null}
        </View>
      )}
    </StackScrollScreen>
  );
}
