import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { EmptyStateCard } from '@/components/empty-state-card';
import { QueryStateCard } from '@/components/query-state-card';
import { Screen } from '@/components/screen';
import { SectionLabel } from '@/components/section-label';
import { useAuth } from '@/features/auth/auth-context';
import { ActivityLogRow } from '@/features/body/activity-log-row';
import { calculateWeightTrend } from '@/features/body/body-domain';
import { useBodyData } from '@/features/body/body-queries';
import { WeightTrendChart } from '@/features/body/weight-trend-chart';
import { useUpdateProfile } from '@/features/profile/profile-queries';
import { useTodayData } from '@/features/today/today-queries';
import { useCurrentDate } from '@/features/today/use-current-date';
import { formatLocalizedWeight, formatLocalizedWeightChange } from '@/features/units/weight';
import { getCurrentLocale } from '@/i18n';
import { colors, layout, opacity, radius, spacing } from '@/theme';
import type { FitnessGoal } from '@/types/database';

const goals: FitnessGoal[] = ['cut', 'maintain', 'gain'];

function MacroStat({ label, value }: { label: string; value: number }) {
  const { t } = useTranslation('common');

  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <AppText adjustsFontSizeToFit numberOfLines={1} variant="label">
        {label}
      </AppText>
      <AppText color="textSecondary" selectable variant="bodyStrong">
        {value} {t('units.grams')}
      </AppText>
    </View>
  );
}

function NutritionBreakdownRow({
  label,
  locale,
  signed = false,
  value,
}: {
  label: string;
  locale: string;
  signed?: boolean;
  value: number;
}) {
  const { t } = useTranslation('common');

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
      <AppText color="textSecondary" style={{ flex: 1 }} variant="caption">
        {label}
      </AppText>
      <AppText color="textSecondary" selectable variant="bodyStrong">
        {new Intl.NumberFormat(locale, { signDisplay: signed ? 'exceptZero' : 'auto' }).format(
          value,
        )}{' '}
        {t('units.calories')}
      </AppText>
    </View>
  );
}

function GoalSelector({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (goal: FitnessGoal) => void;
  value: FitnessGoal | null;
}) {
  const { t } = useTranslation('body');

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        backgroundColor: colors.surface,
        borderCurve: 'continuous',
        borderRadius: radius.md,
        flexDirection: 'row',
        gap: spacing.xs,
        padding: spacing.xs,
      }}
    >
      {goals.map((goal) => {
        const selected = goal === value;

        return (
          <Pressable
            accessibilityLabel={t(`goalOptions.${goal}`)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={goal}
            onPress={() => onChange(goal)}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: selected ? colors.surfaceSelected : colors.transparent,
              borderCurve: 'continuous',
              borderRadius: radius.sm,
              flex: 1,
              justifyContent: 'center',
              minHeight: layout.minTouchTarget,
              opacity: disabled ? opacity.disabled : pressed ? opacity.pressed : 1,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.md,
            })}
          >
            <AppText color={selected ? 'primary' : 'textMuted'} variant="caption">
              {t(`goalOptions.${goal}`)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function WeightMetric({
  label,
  unit,
  value,
  valueColor = 'textPrimary',
}: {
  label: string;
  unit: string;
  value: string;
  valueColor?: 'primary' | 'textPrimary' | 'textSecondary';
}) {
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: spacing.xs }}>
        <AppText color={valueColor} selectable variant="title">
          {value}
        </AppText>
        <AppText color="textMuted" variant="caption">
          {unit}
        </AppText>
      </View>
    </View>
  );
}

export function BodyScreen() {
  const { t } = useTranslation(['body', 'common']);
  const router = useRouter();
  const { profile, user } = useAuth();
  const { dateKey } = useCurrentDate();
  const body = useBodyData(user?.id ?? '', dateKey);
  const today = useTodayData(user?.id ?? '', dateKey, profile);
  const updateProfile = useUpdateProfile(user?.id ?? '');
  const locale = profile?.locale ?? getCurrentLocale();
  const retry = () => {
    void body.refetch();
    void today.refetch();
  };

  if (body.isPending || today.isPending) {
    return (
      <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
        <QueryStateCard detail={t('status.loadingDetail')} title={t('status.loadingTitle')} />
      </Screen>
    );
  }

  if (body.isError || today.isError || !body.data || !today.data || !profile || !user) {
    return (
      <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
        <QueryStateCard
          actionLabel={t('status.retry')}
          detail={t('status.errorDetail')}
          onAction={retry}
          title={t('status.errorTitle')}
        />
      </Screen>
    );
  }

  const target = today.data.nutritionTarget;
  const unit = profile.preferred_weight_unit;
  const unitLabel = t(unit === 'lb' ? 'units.pounds' : 'units.kilograms', { ns: 'common' });
  const weightTrend = calculateWeightTrend(body.data.weightLogs, dateKey);
  const currentWeight = today.data.latestWeight?.weight_kg ?? null;
  const goalChange = (goal: FitnessGoal) => {
    if (goal !== profile.goal) {
      updateProfile.mutate({ goal });
    }
  };

  return (
    <Screen header={<AppHeader eyebrow={t('eyebrow')} title={t('title')} />}>
      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('goal')} />
        <GoalSelector
          disabled={updateProfile.isPending}
          onChange={goalChange}
          value={profile.goal}
        />
        {updateProfile.isError ? (
          <AppText color="danger" variant="caption">
            {t('goalUpdateError')}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('nutrition')} />
        <Card elevated padding="large" style={{ gap: spacing.xl }}>
          {target ? (
            <>
              <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}>
                <AppText variant="label">{t('nutritionDaily')}</AppText>
                <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm }}>
                  <AppText color="primary" selectable variant="display">
                    {new Intl.NumberFormat(locale).format(target.calories)}
                  </AppText>
                  <AppText color="textMuted" variant="bodyStrong">
                    {t('units.calories', { ns: 'common' })}
                  </AppText>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: colors.border,
                  height: layout.borderWidth,
                  width: '100%',
                }}
              />
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <MacroStat label={t('protein')} value={target.protein_grams} />
                <MacroStat label={t('carbs')} value={target.carbohydrate_grams} />
                <MacroStat label={t('fat')} value={target.fat_grams} />
              </View>
              {target.baseline_calories !== null &&
              target.planned_training_calories !== null &&
              target.goal_adjustment_calories !== null ? (
                <>
                  <View
                    style={{
                      backgroundColor: colors.border,
                      height: layout.borderWidth,
                      width: '100%',
                    }}
                  />
                  <View style={{ gap: spacing.sm }}>
                    <AppText variant="label">{t('nutritionBreakdown')}</AppText>
                    <NutritionBreakdownRow
                      label={t('baselineCalories')}
                      locale={locale}
                      value={target.baseline_calories}
                    />
                    <NutritionBreakdownRow
                      label={t('plannedTrainingCalories')}
                      locale={locale}
                      signed
                      value={target.planned_training_calories}
                    />
                    <NutritionBreakdownRow
                      label={t('goalAdjustmentCalories')}
                      locale={locale}
                      signed
                      value={target.goal_adjustment_calories}
                    />
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="title">{t('nutritionUnavailable')}</AppText>
              <AppText color="textSecondary">{t('nutritionDetail')}</AppText>
            </View>
          )}
          <AppButton
            onPress={() => router.push('/profile')}
            title={t('profileAction')}
            variant="secondary"
          />
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('weight')} />
        {currentWeight === null ? (
          <EmptyStateCard
            actionLabel={t('logWeight')}
            detail={t('weightDetail')}
            onAction={() => router.push('/today-weight')}
            title={t('weightEmpty')}
          />
        ) : (
          <Card elevated padding="large" style={{ gap: spacing.xl }}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label">{t('weightMetrics.current')}</AppText>
              <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm }}>
                <AppText color="primary" selectable variant="stat">
                  {formatLocalizedWeight(currentWeight, unit, locale)}
                </AppText>
                <AppText color="textMuted" variant="bodyStrong">
                  {unitLabel}
                </AppText>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xl }}>
              <WeightMetric
                label={t('weightMetrics.average')}
                unit={unitLabel}
                value={
                  weightTrend.sevenDayAverageKg === null
                    ? t('weightMetrics.unavailable')
                    : formatLocalizedWeight(weightTrend.sevenDayAverageKg, unit, locale)
                }
              />
              <WeightMetric
                label={t('weightMetrics.weeklyTrend')}
                unit={weightTrend.weeklyChangeKg === null ? '' : unitLabel}
                value={
                  weightTrend.weeklyChangeKg === null
                    ? t('weightMetrics.unavailable')
                    : formatLocalizedWeightChange(weightTrend.weeklyChangeKg, unit, locale, 2)
                }
                valueColor={weightTrend.weeklyChangeKg === null ? 'textSecondary' : 'primary'}
              />
            </View>

            <View
              style={{
                backgroundColor: colors.border,
                height: layout.borderWidth,
                width: '100%',
              }}
            />

            <View style={{ gap: spacing.xs }}>
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <AppText variant="bodyStrong">{t('weightChart.title')}</AppText>
                <AppText color="textMuted" variant="caption">
                  {t('weightChart.period')}
                </AppText>
              </View>
              <AppText color="textMuted" variant="caption">
                {t('weightChart.detail')}
              </AppText>
            </View>

            {weightTrend.chartPoints.length > 0 ? (
              <WeightTrendChart
                accessibilityLabel={t('weightChart.accessibilityLabel')}
                locale={locale}
                points={weightTrend.chartPoints}
                unit={unit}
              />
            ) : (
              <AppText color="textSecondary">{t('weightChart.empty')}</AppText>
            )}

            <AppButton
              onPress={() => router.push('/today-weight')}
              title={t(today.data.todayWeight ? 'editWeight' : 'logWeight')}
            />
          </Card>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionLabel title={t('activity.title')} />
        {body.data.recentActivities.length === 0 ? (
          <EmptyStateCard
            actionLabel={t('activity.add')}
            detail={t('activity.emptyDetail')}
            onAction={() => router.push('/today-activity')}
            title={t('activity.emptyTitle')}
          />
        ) : (
          <Card elevated padding="large" style={{ gap: spacing.lg }}>
            {body.data.recentActivities.map((activity, index) => (
              <View key={activity.id} style={{ gap: spacing.lg }}>
                {index > 0 ? (
                  <View
                    style={{
                      backgroundColor: colors.border,
                      height: layout.borderWidth,
                    }}
                  />
                ) : null}
                <ActivityLogRow activity={activity} locale={locale} />
              </View>
            ))}
          </Card>
        )}

        {body.data.recentActivities.length > 0 ? (
          <AppButton onPress={() => router.push('/today-activity')} title={t('activity.add')} />
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <AppButton
            onPress={() => router.push('/body-activity-history')}
            style={{ flex: 1 }}
            title={t('activity.seeAll')}
            variant="secondary"
          />
          <AppButton
            onPress={() => router.push('/body-activity-new')}
            style={{ flex: 1 }}
            title={t('activity.createCustom')}
            variant="secondary"
          />
        </View>
      </View>
    </Screen>
  );
}
