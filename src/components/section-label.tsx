import { View } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './app-text';

type SectionLabelProps = {
  action?: string;
  title: string;
};

export function SectionLabel({ action, title }: SectionLabelProps) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
      <AppText style={{ flex: 1 }} variant="label">
        {title}
      </AppText>
      {action ? (
        <AppText color="primary" variant="caption">
          {action}
        </AppText>
      ) : null}
    </View>
  );
}
