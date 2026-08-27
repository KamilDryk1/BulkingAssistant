import { useFocusEffect } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import { colors, layout, spacing } from '@/theme';

type ScreenProps = PropsWithChildren<{
  header?: ReactNode;
}>;

export function Screen({ children, header }: ScreenProps) {
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      const frame = requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ animated: false, y: spacing.none });
      });

      return () => cancelAnimationFrame(frame);
    }, []),
  );

  return (
    <SafeAreaView
      edges={{ bottom: true, left: true, right: true, top: true }}
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <ScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        style={{ backgroundColor: colors.background, flex: 1 }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom:
            process.env.EXPO_OS === 'web' ? layout.tabBarHeight + spacing.xxxl : spacing.xxxl,
        }}
      >
        <View
          style={{
            flex: 1,
            gap: spacing.xxl,
            maxWidth: layout.maxContentWidth,
            paddingHorizontal: layout.screenPadding,
            paddingTop: spacing.lg,
            width: '100%',
          }}
        >
          {header}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
