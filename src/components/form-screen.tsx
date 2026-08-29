import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme';

import { AppHeader } from './app-header';
import { AppText } from './app-text';

type FormScreenProps = PropsWithChildren<{
  detail: string;
  eyebrow: string;
  title: string;
}>;

export function FormScreen({ children, detail, eyebrow, title }: FormScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + spacing.huge,
          paddingTop: insets.top + spacing.lg,
        }}
      >
        <View
          style={{
            gap: spacing.xxl,
            maxWidth: layout.maxContentWidth,
            paddingHorizontal: layout.screenPadding,
            width: '100%',
          }}
        >
          <AppHeader eyebrow={eyebrow} title={title} />
          <AppText color="textSecondary">{detail}</AppText>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
