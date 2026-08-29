import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme';

type StackScrollScreenProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function StackScrollScreen({ children, contentStyle }: StackScrollScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + spacing.huge,
        }}
      >
        <View
          style={[
            {
              gap: spacing.xxl,
              maxWidth: layout.maxContentWidth,
              paddingHorizontal: layout.screenPadding,
              paddingTop: spacing.lg,
              width: '100%',
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
