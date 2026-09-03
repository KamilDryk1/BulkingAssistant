import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { QueryStateCard } from '@/components/query-state-card';
import { StackScrollScreen } from '@/components/stack-scroll-screen';
import {
  useAcceptDailyAnalysis,
  useDailyAnalysis,
  useDismissDailyAnalysis,
} from '@/features/ai/daily-analysis-queries';
import { useAuth } from '@/features/auth/auth-context';
import { useTodayData } from '@/features/today/today-queries';
import { getDailyAnalysisResult } from '@/services/ai/daily-analysis-service';
import { colors, layout, spacing } from '@/theme';

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function DailySuggestionScreen() {
  const { t } = useTranslation(['ai', 'common']);
  const router = useRouter();
  const params = useLocalSearchParams<{ analysisId?: string | string[] }>();
  const analysisId = normalizeParam(params.analysisId);
  const { profile, user } = useAuth();
  const analysis = useDailyAnalysis(analysisId);
  const dismiss = useDismissDailyAnalysis();
  const accept = useAcceptDailyAnalysis(user?.id ?? '');
  const analysisDate = analysis.data?.analysis_date ?? '';
  const today = useTodayData(user?.id ?? '', analysisDate, profile);

  const closeWithDismissal = () => {
    if (!analysisId) {
      router.back();
      return;
    }

    dismiss.mutate(analysisId, { onSuccess: () => router.back() });
  };

  if (analysis.isPending || (analysis.data?.status === 'suggestion' && today.isPending)) {
    return (
      <StackScrollScreen>
        <QueryStateCard
          detail={t('suggestion.loadingDetail')}
          title={t('suggestion.loadingTitle')}
        />
      </StackScrollScreen>
    );
  }

  if (
    analysis.isError ||
    !analysis.data ||
    analysis.data.status !== 'suggestion' ||
    today.isError ||
    !user
  ) {
    return (
      <StackScrollScreen>
        <QueryStateCard
          actionLabel={t('actions.close')}
          detail={t('suggestion.errorDetail')}
          onAction={() => router.back()}
          title={t('suggestion.errorTitle')}
        />
      </StackScrollScreen>
    );
  }

  const result = getDailyAnalysisResult(analysis.data);
  if (!result || result.status !== 'suggestion') {
    return null;
  }

  const calorieDelta =
    result.proposedAction.type === 'adjust_calories' ? result.proposedAction.value : null;
  const currentCalories = today.data?.nutritionTarget?.calories ?? null;
  const suggestedCalories =
    currentCalories !== null && calorieDelta !== null ? currentCalories + calorieDelta : null;
  const locale = profile?.locale ?? 'en';
  const formatCalories = (value: number) => new Intl.NumberFormat(locale).format(value);
  const apply = () => accept.mutate(analysisId, { onSuccess: () => router.back() });

  return (
    <StackScrollScreen>
      <View style={{ gap: spacing.sm }}>
        <AppText color="primary" variant="label">
          {t('suggestion.eyebrow')}
        </AppText>
        <AppText selectable variant="heading">
          {result.title}
        </AppText>
        <AppText color="textSecondary" selectable>
          {result.message}
        </AppText>
      </View>

      <Card elevated padding="large" style={{ gap: spacing.lg }}>
        <AppText variant="label">{t('suggestion.evidence')}</AppText>
        {result.evidence.map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <AppText accessibilityElementsHidden color="primary" importantForAccessibility="no">
              •
            </AppText>
            <AppText color="textSecondary" selectable style={{ flex: 1 }}>
              {item}
            </AppText>
          </View>
        ))}
      </Card>

      {currentCalories !== null && suggestedCalories !== null && calorieDelta !== null ? (
        <Card style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="label">{t('suggestion.currentTarget')}</AppText>
              <AppText selectable variant="title">
                {formatCalories(currentCalories)} {t('units.calories', { ns: 'common' })}
              </AppText>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="label">{t('suggestion.suggestedTarget')}</AppText>
              <AppText color="primary" selectable variant="title">
                {formatCalories(suggestedCalories)} {t('units.calories', { ns: 'common' })}
              </AppText>
            </View>
          </View>
          <View
            style={{ backgroundColor: colors.border, height: layout.borderWidth, width: '100%' }}
          />
          <AppText color="textMuted" variant="caption">
            {t('suggestion.requiresApproval')}
          </AppText>
        </Card>
      ) : null}

      {accept.isError || dismiss.isError ? (
        <AppText color="danger" variant="caption">
          {t('suggestion.actionError')}
        </AppText>
      ) : null}

      {calorieDelta !== null ? (
        <AppButton
          loading={accept.isPending}
          onPress={apply}
          title={t('suggestion.applyCalories', {
            value: new Intl.NumberFormat(locale, { signDisplay: 'always' }).format(calorieDelta),
          })}
        />
      ) : null}
      <AppButton
        disabled={accept.isPending || dismiss.isPending}
        onPress={() =>
          router.replace({ pathname: '/coach', params: { analysisId } } as unknown as Href)
        }
        title={t('suggestion.discussWithCoach')}
        variant="secondary"
      />
      <AppButton
        disabled={accept.isPending}
        loading={dismiss.isPending}
        onPress={closeWithDismissal}
        title={t('suggestion.notNow')}
        variant="ghost"
      />
    </StackScrollScreen>
  );
}
