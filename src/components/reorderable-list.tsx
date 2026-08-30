import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { layout, motion, spacing } from '@/theme';
import { calculateAutoScrollVelocity } from '@/utils/auto-scroll';

import { useAutoScrollContext, type AutoScrollContextValue } from './auto-scroll-context';

type ItemHeights = Record<string, number>;

type ReorderableListProps = {
  gap?: number;
  itemKeys: readonly string[];
  onMove: (fromIndex: number, toIndex: number) => void;
  renderItem: (itemKey: string, index: number) => ReactNode;
};

type ReorderableRowProps = {
  activeKey: SharedValue<string | null>;
  autoScroll: AutoScrollContextValue | null;
  dragPosition: SharedValue<number>;
  fingerPosition: SharedValue<number>;
  gap: number;
  heights: SharedValue<ItemHeights>;
  initialTop: number;
  itemKey: string;
  onMeasure: (itemKey: string, height: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  scrollDuringDrag: SharedValue<number>;
  setAutoScrollActive: (active: boolean) => void;
  sourceIndex: SharedValue<number>;
  startOrder: SharedValue<string[]>;
  targetIndex: SharedValue<number>;
  visualOrder: SharedValue<string[]>;
  viewportHeight: SharedValue<number>;
  viewportTop: SharedValue<number>;
  children: ReactNode;
};

function getItemTop(order: readonly string[], itemKey: string, heights: ItemHeights, gap: number) {
  'worklet';

  let top = 0;

  for (const key of order) {
    if (key === itemKey) {
      return top;
    }

    top += (heights[key] ?? 0) + gap;
  }

  return top;
}

function getListHeight(order: readonly string[], heights: ItemHeights, gap: number) {
  'worklet';

  return order.reduce((total, key, index) => {
    return total + (heights[key] ?? 0) + (index === order.length - 1 ? 0 : gap);
  }, 0);
}

function getTargetIndex(
  order: readonly string[],
  itemKey: string,
  draggedCenter: number,
  heights: ItemHeights,
  gap: number,
) {
  'worklet';

  let index = 0;

  for (const key of order) {
    if (key === itemKey) {
      continue;
    }

    const center = getItemTop(order, key, heights, gap) + (heights[key] ?? 0) / 2;
    if (draggedCenter > center) {
      index += 1;
    }
  }

  return Math.min(index, order.length - 1);
}

function moveKey(order: readonly string[], itemKey: string, toIndex: number) {
  'worklet';

  const nextOrder = order.filter((key) => key !== itemKey);
  nextOrder.splice(toIndex, 0, itemKey);
  return nextOrder;
}

function updateDragTarget(
  order: readonly string[],
  itemKey: string,
  itemPosition: number,
  heights: ItemHeights,
  gap: number,
  targetIndex: SharedValue<number>,
  visualOrder: SharedValue<string[]>,
) {
  'worklet';

  const itemHeight = heights[itemKey] ?? 0;
  const nextTargetIndex = getTargetIndex(
    order,
    itemKey,
    itemPosition + itemHeight / 2,
    heights,
    gap,
  );

  if (nextTargetIndex !== targetIndex.get()) {
    targetIndex.set(nextTargetIndex);
    visualOrder.set(moveKey(order, itemKey, nextTargetIndex));
  }
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';

  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function ReorderableRow({
  activeKey,
  autoScroll,
  children,
  dragPosition,
  fingerPosition,
  gap,
  heights,
  initialTop,
  itemKey,
  onMeasure,
  onMove,
  scrollDuringDrag,
  setAutoScrollActive,
  sourceIndex,
  startOrder,
  targetIndex,
  visualOrder,
  viewportHeight,
  viewportTop,
}: ReorderableRowProps) {
  const restingPosition = useSharedValue(initialTop);

  useAnimatedReaction(
    () => getItemTop(visualOrder.get(), itemKey, heights.get(), gap),
    (nextPosition, previousPosition) => {
      if (nextPosition !== previousPosition) {
        restingPosition.set(
          withSpring(nextPosition, {
            dampingRatio: 1,
            duration: motion.slow,
            reduceMotion: ReduceMotion.System,
          }),
        );
      }
    },
    [gap, itemKey],
  );

  const finishMove = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex !== toIndex) {
        onMove(fromIndex, toIndex);
      }
    },
    [onMove],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(motion.dragIntent)
        .onStart((event) => {
          const order = visualOrder.get();
          const index = order.indexOf(itemKey);

          startOrder.set([...order]);
          sourceIndex.set(index);
          targetIndex.set(index);
          scrollDuringDrag.set(0);
          dragPosition.set(getItemTop(order, itemKey, heights.get(), gap));
          fingerPosition.set(event.absoluteY);

          if (autoScroll) {
            const viewport = autoScroll.measureViewport();
            if (viewport) {
              viewportHeight.set(viewport.height);
              viewportTop.set(viewport.pageY);
            }
          }

          activeKey.set(itemKey);
          scheduleOnRN(setAutoScrollActive, true);
        })
        .onUpdate((event) => {
          const order = startOrder.get();
          const itemHeights = heights.get();
          const itemHeight = itemHeights[itemKey] ?? 0;
          const initialPosition = getItemTop(order, itemKey, itemHeights, gap);
          const rawPosition = initialPosition + event.translationY + scrollDuringDrag.get();
          const listHeight = getListHeight(order, itemHeights, gap);
          const maximumPosition = Math.max(0, listHeight - itemHeight);
          const nextPosition =
            rawPosition < 0
              ? rubberband(rawPosition, listHeight)
              : rawPosition > maximumPosition
                ? maximumPosition + rubberband(rawPosition - maximumPosition, listHeight)
                : rawPosition;

          dragPosition.set(nextPosition);
          fingerPosition.set(event.absoluteY);
          updateDragTarget(
            order,
            itemKey,
            nextPosition,
            itemHeights,
            gap,
            targetIndex,
            visualOrder,
          );
        })
        .onEnd((event) => {
          scheduleOnRN(setAutoScrollActive, false);
          const destination = getItemTop(visualOrder.get(), itemKey, heights.get(), gap);

          dragPosition.set(
            withSpring(
              destination,
              {
                dampingRatio: 0.8,
                duration: motion.slow,
                reduceMotion: ReduceMotion.System,
                velocity: event.velocityY,
              },
              (finished) => {
                if (finished) {
                  const fromIndex = sourceIndex.get();
                  const toIndex = targetIndex.get();
                  activeKey.set(null);
                  scheduleOnRN(finishMove, fromIndex, toIndex);
                }
              },
            ),
          );
        })
        .onFinalize((_event, success) => {
          if (!success && activeKey.get() === itemKey) {
            scheduleOnRN(setAutoScrollActive, false);
            const order = startOrder.get();
            visualOrder.set(order);
            dragPosition.set(
              withSpring(
                getItemTop(order, itemKey, heights.get(), gap),
                {
                  dampingRatio: 1,
                  duration: motion.slow,
                  reduceMotion: ReduceMotion.System,
                },
                (finished) => {
                  if (finished) {
                    activeKey.set(null);
                  }
                },
              ),
            );
          }
        }),
    [
      activeKey,
      autoScroll,
      dragPosition,
      fingerPosition,
      finishMove,
      gap,
      heights,
      itemKey,
      scrollDuringDrag,
      setAutoScrollActive,
      sourceIndex,
      startOrder,
      targetIndex,
      visualOrder,
      viewportHeight,
      viewportTop,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const active = activeKey.get() === itemKey;

    return {
      transform: [
        { translateY: active ? dragPosition.get() : restingPosition.get() },
        {
          scale: withSpring(active ? motion.dragScale : 1, {
            dampingRatio: 1,
            duration: motion.fast,
            reduceMotion: ReduceMotion.System,
          }),
        },
      ],
      zIndex: active ? 1 : 0,
    };
  });

  const measure = useCallback(
    (event: LayoutChangeEvent) => onMeasure(itemKey, event.nativeEvent.layout.height),
    [itemKey, onMeasure],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={measure}
        style={[{ left: 0, position: 'absolute', right: 0 }, animatedStyle]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export function ReorderableList({
  gap = spacing.sm,
  itemKeys,
  onMove,
  renderItem,
}: ReorderableListProps) {
  const autoScroll = useAutoScrollContext();
  const stableKeys = useMemo(() => [...itemKeys], [itemKeys]);
  const [measuredHeights, setMeasuredHeights] = useState<ItemHeights>({});
  const visualOrder = useSharedValue(stableKeys);
  const startOrder = useSharedValue(stableKeys);
  const heights = useSharedValue<ItemHeights>({});
  const activeKey = useSharedValue<string | null>(null);
  const sourceIndex = useSharedValue(-1);
  const targetIndex = useSharedValue(-1);
  const dragPosition = useSharedValue(0);
  const fingerPosition = useSharedValue(0);
  const scrollDuringDrag = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const viewportTop = useSharedValue(0);

  const autoScrollFrame = useFrameCallback(({ timeSincePreviousFrame }) => {
    const itemKey = activeKey.get();

    if (!autoScroll || !itemKey || timeSincePreviousFrame === null) {
      return;
    }

    const viewportStart = viewportTop.get();
    const velocity = calculateAutoScrollVelocity({
      edgeSize: layout.dragAutoScrollEdge,
      fingerY: fingerPosition.get(),
      maximumSpeed: motion.dragAutoScrollSpeed,
      viewportHeight: viewportHeight.get(),
      viewportTop: viewportStart,
    });

    if (velocity === 0) {
      return;
    }

    const order = startOrder.get();
    const itemHeights = heights.get();
    const itemHeight = itemHeights[itemKey] ?? 0;
    const maximumItemPosition = Math.max(0, getListHeight(order, itemHeights, gap) - itemHeight);
    const currentItemPosition = dragPosition.get();
    const frameSeconds = Math.min(timeSincePreviousFrame, 32) / 1000;
    let offsetDelta = velocity * frameSeconds;

    if (offsetDelta < 0) {
      if (currentItemPosition <= 0) {
        return;
      }
      offsetDelta = Math.max(offsetDelta, -currentItemPosition);
    } else {
      if (currentItemPosition >= maximumItemPosition) {
        return;
      }
      offsetDelta = Math.min(offsetDelta, maximumItemPosition - currentItemPosition);
    }

    const currentOffset = autoScroll.scrollOffset.get();
    const minimumOffset = autoScroll.minimumOffset.get();
    const maximumOffset = Math.max(
      minimumOffset,
      autoScroll.contentHeight.get() -
        autoScroll.viewportHeight.get() +
        autoScroll.bottomInset.get(),
    );
    const nextOffset = Math.min(
      maximumOffset,
      Math.max(minimumOffset, currentOffset + offsetDelta),
    );
    const appliedDelta = nextOffset - currentOffset;

    if (Math.abs(appliedDelta) < 0.01) {
      return;
    }

    const nextItemPosition = currentItemPosition + appliedDelta;
    autoScroll.scrollOffset.set(nextOffset);
    autoScroll.scrollToOffset(nextOffset);
    scrollDuringDrag.set(scrollDuringDrag.get() + appliedDelta);
    dragPosition.set(nextItemPosition);
    updateDragTarget(order, itemKey, nextItemPosition, itemHeights, gap, targetIndex, visualOrder);
  }, false);

  const setAutoScrollActive = useCallback(
    (active: boolean) => autoScrollFrame.setActive(active),
    [autoScrollFrame],
  );

  useEffect(() => {
    heights.set(measuredHeights);
  }, [heights, measuredHeights]);

  useEffect(() => {
    if (activeKey.get() === null) {
      visualOrder.set(stableKeys);
      startOrder.set(stableKeys);
    }
  }, [activeKey, stableKeys, startOrder, visualOrder]);

  const measureItem = useCallback((itemKey: string, height: number) => {
    setMeasuredHeights((current) =>
      current[itemKey] === height ? current : { ...current, [itemKey]: height },
    );
  }, []);

  const allItemsMeasured = stableKeys.every((itemKey) => (measuredHeights[itemKey] ?? 0) > 0);

  if (stableKeys.length < 2 || !allItemsMeasured) {
    return (
      <View style={{ gap }}>
        {stableKeys.map((itemKey, index) => (
          <View
            key={itemKey}
            onLayout={(event) => measureItem(itemKey, event.nativeEvent.layout.height)}
          >
            {renderItem(itemKey, index)}
          </View>
        ))}
      </View>
    );
  }

  const containerHeight = stableKeys.reduce(
    (total, itemKey, index) =>
      total + measuredHeights[itemKey] + (index === stableKeys.length - 1 ? 0 : gap),
    0,
  );

  let initialTop = 0;

  return (
    <View style={{ height: containerHeight, position: 'relative' }}>
      {stableKeys.map((itemKey, index) => {
        const itemTop = initialTop;
        initialTop += measuredHeights[itemKey] + gap;

        return (
          <ReorderableRow
            activeKey={activeKey}
            autoScroll={autoScroll}
            dragPosition={dragPosition}
            fingerPosition={fingerPosition}
            gap={gap}
            heights={heights}
            initialTop={itemTop}
            itemKey={itemKey}
            key={itemKey}
            onMeasure={measureItem}
            onMove={onMove}
            scrollDuringDrag={scrollDuringDrag}
            setAutoScrollActive={setAutoScrollActive}
            sourceIndex={sourceIndex}
            startOrder={startOrder}
            targetIndex={targetIndex}
            visualOrder={visualOrder}
            viewportHeight={viewportHeight}
            viewportTop={viewportTop}
          >
            {renderItem(itemKey, index)}
          </ReorderableRow>
        );
      })}
    </View>
  );
}
