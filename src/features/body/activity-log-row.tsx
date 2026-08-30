import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/app-text';
import { CompactAction } from '@/components/compact-action';
import { spacing } from '@/theme';
import type { ActivityLogRow as ActivityLog, AppLocale } from '@/types/database';

type ActivityLogRowProps = {
  activity: ActivityLog;
  deleting?: boolean;
  locale: AppLocale;
  onDelete?: () => void;
  showDate?: boolean;
};

function formatDate(dateKey: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00`));
}

export function ActivityLogRow({
  activity,
  deleting = false,
  locale,
  onDelete,
  showDate = true,
}: ActivityLogRowProps) {
  const { t } = useTranslation('body');
  const details = [
    showDate ? formatDate(activity.activity_date, locale) : null,
    activity.duration_minutes ? t('activity.duration', { count: activity.duration_minutes }) : null,
    activity.intensity ? t(`activity.intensity.${activity.intensity}`) : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText variant="bodyStrong">{activity.activity_name_snapshot}</AppText>
        {details.length ? (
          <AppText color="textMuted" variant="caption">
            {details.join(' · ')}
          </AppText>
        ) : null}
      </View>
      {onDelete ? (
        <CompactAction
          accessibilityLabel={t('activity.delete')}
          disabled={deleting}
          label="×"
          onPress={onDelete}
        />
      ) : null}
    </View>
  );
}
