import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@/theme';

import { AppText } from './app-text';

export function AppLoadingScreen() {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.background,
        flex: 1,
        gap: spacing.lg,
        justifyContent: 'center',
        paddingBottom: insets.bottom,
        paddingHorizontal: spacing.xxl,
        paddingTop: insets.top,
      }}
    >
      <ActivityIndicator color={colors.primary} size="large" />
      <AppText color="textMuted" variant="caption">
        {t('status.loading')}
      </AppText>
    </View>
  );
}
