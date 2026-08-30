import type { Component, PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useMemo } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  measure,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  type MeasuredDimensions,
  type SharedValue,
} from 'react-native-reanimated';

export type AutoScrollContextValue = {
  bottomInset: SharedValue<number>;
  contentHeight: SharedValue<number>;
  measureViewport: () => MeasuredDimensions | null;
  minimumOffset: SharedValue<number>;
  scrollOffset: SharedValue<number>;
  scrollToOffset: (offset: number) => void;
  viewportHeight: SharedValue<number>;
};

const AutoScrollContext = createContext<AutoScrollContextValue | null>(null);

export function AutoScrollProvider({
  children,
  value,
}: PropsWithChildren<{ value: AutoScrollContextValue }>) {
  return <AutoScrollContext.Provider value={value}>{children}</AutoScrollContext.Provider>;
}

export function useAutoScrollContext() {
  return useContext(AutoScrollContext);
}

export function useAutoScrollContainer<TRef extends Component>() {
  const animatedRef = useAnimatedRef<TRef>();
  const bottomInset = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const minimumOffset = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  const viewportHeight = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    bottomInset.set(event.contentInset.bottom);
    minimumOffset.set(-event.contentInset.top);
    scrollOffset.set(event.contentOffset.y);
  });

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => viewportHeight.set(event.nativeEvent.layout.height),
    [viewportHeight],
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => contentHeight.set(height),
    [contentHeight],
  );

  const measureViewport = useCallback(() => {
    'worklet';

    return measure(animatedRef);
  }, [animatedRef]);

  const scrollToOffset = useCallback(
    (offset: number) => {
      'worklet';

      scrollTo(animatedRef, 0, offset, false);
    },
    [animatedRef],
  );

  const value = useMemo<AutoScrollContextValue>(
    () => ({
      bottomInset,
      contentHeight,
      measureViewport,
      minimumOffset,
      scrollOffset,
      scrollToOffset,
      viewportHeight,
    }),
    [
      bottomInset,
      contentHeight,
      measureViewport,
      minimumOffset,
      scrollOffset,
      scrollToOffset,
      viewportHeight,
    ],
  );

  return { animatedRef, onContentSizeChange, onLayout, onScroll, value };
}
