import type { PropsWithChildren } from 'react';
import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme';

import { AutoScrollProvider, useAutoScrollContainer } from './auto-scroll-context';

type StackScrollScreenProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function StackScrollScreen({ children, contentStyle }: StackScrollScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    animatedRef,
    onContentSizeChange,
    onLayout,
    onScroll,
    value: autoScrollValue,
  } = useAutoScrollContainer<ScrollView>();

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <AutoScrollProvider value={autoScrollValue}>
        <Animated.ScrollView
          ref={animatedRef}
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayout}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: colors.background, flex: 1 }}
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
        </Animated.ScrollView>
      </AutoScrollProvider>
    </View>
  );
}
