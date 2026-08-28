import { useRoute } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import { colors, layout, spacing } from '@/theme';

type ScreenProps = PropsWithChildren<{
  header?: ReactNode;
}>;

const scrollResetters = new Map<string, () => void>();

export function resetScreenScroll(routeName: string) {
  scrollResetters.get(routeName)?.();
}

export function Screen({ children, header }: ScreenProps) {
  const route = useRoute();
  const scrollRef = useRef<ScrollView>(null);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ animated: false, y: spacing.none });
  }, []);

  useLayoutEffect(() => {
    scrollResetters.set(route.name, scrollToTop);

    return () => {
      if (scrollResetters.get(route.name) === scrollToTop) {
        scrollResetters.delete(route.name);
      }
    };
  }, [route.name, scrollToTop]);

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollToTop();
    }
  }, [scrollToTop]);

  return (
    <SafeAreaView
      edges={{ bottom: true, left: true, right: true, top: true }}
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <ScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        directionalLockEnabled
        style={{ backgroundColor: colors.background, flex: 1 }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: layout.tabBarHeight + spacing.xxxl,
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
