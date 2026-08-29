import { spacing } from '@/theme';

import { AppButton } from './app-button';
import { AppText } from './app-text';
import { Card } from './card';

type QueryStateCardProps = {
  actionLabel?: string;
  detail: string;
  onAction?: () => void;
  title: string;
};

export function QueryStateCard({ actionLabel, detail, onAction, title }: QueryStateCardProps) {
  return (
    <Card elevated style={{ gap: spacing.lg }}>
      <AppText variant="title">{title}</AppText>
      <AppText color="textSecondary">{detail}</AppText>
      {actionLabel && onAction ? (
        <AppButton onPress={onAction} title={actionLabel} variant="secondary" />
      ) : null}
    </Card>
  );
}
