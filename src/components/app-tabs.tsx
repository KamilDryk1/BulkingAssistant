import {
  GlassView,
  type GlassViewProps,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { TabContext, useTabsWithTriggers } from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import { resetScreenScroll } from '@/components/screen';
import {
  colors,
  fontFamilies,
  layout,
  motion,
  opacity,
  radius,
  spacing,
  typography,
} from '@/theme';

type SymbolName = NonNullable<SymbolViewProps['name']>;
type PlatformSymbolName = Extract<SymbolName, { android?: unknown }>;
type AndroidSymbolName = NonNullable<PlatformSymbolName['android']>;
type IosSymbolName = Extract<SymbolName, string>;

type TabDefinition = {
  androidIcon: AndroidSymbolName;
  href: '/' | '/training' | '/progress' | '/body' | '/settings';
  iosIcon: IosSymbolName;
  labelKey: 'tabs.today' | 'tabs.training' | 'tabs.progress' | 'tabs.body' | 'tabs.settings';
  name: 'index' | 'training' | 'progress' | 'body' | 'settings';
};

const tabDefinitions = [
  {
    androidIcon: 'calendar_today',
    href: '/',
    iosIcon: 'calendar',
    labelKey: 'tabs.today',
    name: 'index',
  },
  {
    androidIcon: 'fitness_center',
    href: '/training',
    iosIcon: 'dumbbell',
    labelKey: 'tabs.training',
    name: 'training',
  },
  {
    androidIcon: 'show_chart',
    href: '/progress',
    iosIcon: 'chart.line.uptrend.xyaxis',
    labelKey: 'tabs.progress',
    name: 'progress',
  },
  {
    androidIcon: 'monitor_weight',
    href: '/body',
    iosIcon: 'figure',
    labelKey: 'tabs.body',
    name: 'body',
  },
  {
    androidIcon: 'settings',
    href: '/settings',
    iosIcon: 'gearshape',
    labelKey: 'tabs.settings',
    name: 'settings',
  },
] as const satisfies readonly TabDefinition[];

const tabTriggers = tabDefinitions.map(({ href, name }) => ({
  href,
  name,
  type: 'internal' as const,
}));

const edgeWidth = 24;
const activationDistance = 12;
const verticalTolerance = 20;
const commitRatio = 0.28;
const decelerationRate = 0.998;
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);
const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

function project(velocity: number) {
  'worklet';

  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function clamp(value: number, lowerBound: number, upperBound: number) {
  'worklet';

  return Math.min(upperBound, Math.max(lowerBound, value));
}

function TabIcon({
  androidIcon,
  index,
  iosIcon,
  selectionPosition,
}: {
  androidIcon: AndroidSymbolName;
  index: number;
  iosIcon: IosSymbolName;
  selectionPosition: SharedValue<number>;
}) {
  const selectedIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      selectionPosition.get(),
      [index - 1, index, index + 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const symbolName = {
    android: androidIcon,
    ios: iosIcon,
  } as const;

  return (
    <View style={styles.tabIcon}>
      <SymbolView
        name={symbolName}
        resizeMode="scaleAspectFit"
        size={layout.iconMedium}
        tintColor={colors.textMuted}
      />
      <Animated.View pointerEvents="none" style={[styles.tabIconSelected, selectedIconStyle]}>
        <SymbolView
          name={symbolName}
          resizeMode="scaleAspectFit"
          size={layout.iconMedium}
          tintColor={colors.primary}
        />
      </Animated.View>
    </View>
  );
}

function TabLabel({
  index,
  isSelected,
  label,
  selectionPosition,
}: {
  index: number;
  isSelected: boolean;
  label: string;
  selectionPosition: SharedValue<number>;
}) {
  const animatedLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectionPosition.get(),
      [index - 1, index, index + 1],
      [colors.textMuted, colors.primary, colors.textMuted],
    ),
  }));

  return (
    <Animated.Text
      numberOfLines={1}
      style={[
        typography.tab,
        { fontFamily: isSelected ? fontFamilies.semibold : fontFamilies.medium },
        animatedLabelStyle,
      ]}
    >
      {label}
    </Animated.Text>
  );
}

export default function AppTabs() {
  const { t } = useTranslation('common');
  const { width: pageWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const { descriptors, navigation, NavigationContent, state } = useTabsWithTriggers({
    triggers: tabTriggers,
  });
  const activeRouteName = state.routes[state.index]?.name;
  const matchedActiveTabIndex = tabDefinitions.findIndex((tab) => tab.name === activeRouteName);
  const activeTabIndex = matchedActiveTabIndex >= 0 ? matchedActiveTabIndex : 0;
  const tabSlotWidth = Math.max(0, (tabBarWidth - spacing.sm * 2) / tabDefinitions.length);
  const tabLensWidth = tabSlotWidth > 0 ? tabSlotWidth + spacing.sm : 0;
  const tabLensHorizontalOverflow = Math.max(0, (tabLensWidth - tabSlotWidth) / 2);
  const tabLensMinimumX = spacing.sm - tabLensHorizontalOverflow;
  const translateX = useSharedValue(-activeTabIndex * pageWidth);
  const gestureStartX = useSharedValue(-activeTabIndex * pageWidth);
  const tabLensX = useSharedValue(tabLensMinimumX);
  const tabLensVisibility = useSharedValue(0);
  const tabLensScale = useSharedValue(1);
  const tabSelectionPosition = useSharedValue(activeTabIndex);

  const handleTabBarLayout = useCallback((event: LayoutChangeEvent) => {
    setTabBarWidth(event.nativeEvent.layout.width);
  }, []);

  const prepareTab = useCallback((index: number) => {
    const tab = tabDefinitions[index];
    if (tab) {
      resetScreenScroll(tab.name);
    }
  }, []);

  const commitTab = useCallback(
    (index: number) => {
      const tab = tabDefinitions[index];
      if (tab) {
        navigation.navigate(tab.name);
      }
    },
    [navigation],
  );

  const selectTab = useCallback(
    (index: number) => {
      const tab = tabDefinitions[index];
      if (!tab) {
        return;
      }

      resetScreenScroll(tab.name);
      cancelAnimation(translateX);
      cancelAnimation(tabSelectionPosition);
      translateX.set(-index * pageWidth);
      tabSelectionPosition.set(index);
      navigation.navigate(tab.name);
    },
    [navigation, pageWidth, tabSelectionPosition, translateX],
  );

  useLayoutEffect(() => {
    const activeTab = tabDefinitions[activeTabIndex];
    if (activeTab) {
      resetScreenScroll(activeTab.name);
    }

    cancelAnimation(translateX);
    cancelAnimation(tabSelectionPosition);
    translateX.set(-activeTabIndex * pageWidth);
    tabSelectionPosition.set(activeTabIndex);
  }, [activeTabIndex, pageWidth, tabSelectionPosition, translateX]);

  useLayoutEffect(() => {
    if (tabSlotWidth <= 0) {
      return;
    }

    tabLensX.set(
      withSpring(tabLensMinimumX + activeTabIndex * tabSlotWidth, {
        dampingRatio: 1,
        duration: 400,
        overshootClamping: true,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [activeTabIndex, tabLensMinimumX, tabLensX, tabSlotWidth]);

  const edgeSwipeGesture = useMemo(() => {
    const settle = (destinationIndex: number, velocity: number, shouldCommit: boolean) => {
      'worklet';

      tabSelectionPosition.set(
        withSpring(destinationIndex, {
          dampingRatio: shouldCommit ? 1 : 0.8,
          duration: shouldCommit ? 300 : 400,
          overshootClamping: true,
          reduceMotion: ReduceMotion.System,
          velocity: pageWidth > 0 ? -velocity / pageWidth : 0,
        }),
      );
      translateX.set(
        withSpring(
          -destinationIndex * pageWidth,
          {
            dampingRatio: shouldCommit ? 1 : 0.8,
            duration: shouldCommit ? 300 : 400,
            overshootClamping: shouldCommit,
            reduceMotion: ReduceMotion.System,
            velocity,
          },
          (finished) => {
            if (finished && shouldCommit) {
              scheduleOnRN(commitTab, destinationIndex);
            }
          },
        ),
      );
    };

    const previousIndex = activeTabIndex - 1;
    const nextIndex = activeTabIndex + 1;

    const fromLeftEdge = Gesture.Pan()
      .enabled(previousIndex >= 0)
      .hitSlop({ left: 0, width: edgeWidth })
      .activeOffsetX(activationDistance)
      .failOffsetY([-verticalTolerance, verticalTolerance])
      .onStart(() => {
        cancelAnimation(translateX);
        cancelAnimation(tabSelectionPosition);
        gestureStartX.set(translateX.get());
        tabSelectionPosition.set(activeTabIndex);
        scheduleOnRN(prepareTab, previousIndex);
      })
      .onUpdate((event) => {
        const previousPageX = -previousIndex * pageWidth;
        const nextX = gestureStartX.get() + Math.max(0, event.translationX);
        const clampedX = Math.min(previousPageX, nextX);
        translateX.set(clampedX);
        tabSelectionPosition.set(pageWidth > 0 ? -clampedX / pageWidth : activeTabIndex);
      })
      .onEnd((event) => {
        const projectedX = event.translationX + project(event.velocityX);
        const shouldCommit = projectedX >= pageWidth * commitRatio;
        settle(shouldCommit ? previousIndex : activeTabIndex, event.velocityX, shouldCommit);
      });

    const fromRightEdge = Gesture.Pan()
      .enabled(nextIndex < tabDefinitions.length)
      .hitSlop({ right: 0, width: edgeWidth })
      .activeOffsetX(-activationDistance)
      .failOffsetY([-verticalTolerance, verticalTolerance])
      .onStart(() => {
        cancelAnimation(translateX);
        cancelAnimation(tabSelectionPosition);
        gestureStartX.set(translateX.get());
        tabSelectionPosition.set(activeTabIndex);
        scheduleOnRN(prepareTab, nextIndex);
      })
      .onUpdate((event) => {
        const nextPageX = -nextIndex * pageWidth;
        const nextX = gestureStartX.get() + Math.min(0, event.translationX);
        const clampedX = Math.max(nextPageX, nextX);
        translateX.set(clampedX);
        tabSelectionPosition.set(pageWidth > 0 ? -clampedX / pageWidth : activeTabIndex);
      })
      .onEnd((event) => {
        const projectedX = event.translationX + project(event.velocityX);
        const shouldCommit = projectedX <= -pageWidth * commitRatio;
        settle(shouldCommit ? nextIndex : activeTabIndex, event.velocityX, shouldCommit);
      });

    return Gesture.Simultaneous(fromLeftEdge, fromRightEdge);
  }, [
    activeTabIndex,
    commitTab,
    gestureStartX,
    pageWidth,
    prepareTab,
    tabSelectionPosition,
    translateX,
  ]);

  const tabBarSelectionGesture = useMemo(() => {
    const minimumX = tabLensMinimumX;
    const maximumX = minimumX + tabSlotWidth * (tabDefinitions.length - 1);

    const settleLens = (index: number, velocity: number) => {
      'worklet';

      tabSelectionPosition.set(
        withSpring(index, {
          dampingRatio: 0.8,
          duration: 400,
          overshootClamping: true,
          reduceMotion: ReduceMotion.System,
          velocity: tabSlotWidth > 0 ? velocity / tabSlotWidth : 0,
        }),
      );
      tabLensX.set(
        withSpring(minimumX + index * tabSlotWidth, {
          dampingRatio: 0.8,
          duration: 400,
          overshootClamping: true,
          reduceMotion: ReduceMotion.System,
          velocity,
        }),
      );
    };

    return Gesture.Pan()
      .enabled(tabSlotWidth > 0)
      .failOffsetY([-verticalTolerance, verticalTolerance])
      .onBegin((event) => {
        cancelAnimation(tabLensX);
        cancelAnimation(tabLensVisibility);
        cancelAnimation(tabLensScale);
        cancelAnimation(tabSelectionPosition);
        const nextLensX = clamp(event.x - tabLensWidth / 2, minimumX, maximumX);
        tabLensX.set(nextLensX);
        tabSelectionPosition.set(
          tabSlotWidth > 0 ? (nextLensX - minimumX) / tabSlotWidth : activeTabIndex,
        );
        tabLensVisibility.set(0);
        tabLensScale.set(0.97);
        tabLensVisibility.set(
          withDelay(
            motion.touchIntent,
            withTiming(1, {
              duration: motion.instant,
              reduceMotion: ReduceMotion.System,
            }),
          ),
        );
        tabLensScale.set(
          withDelay(
            motion.touchIntent,
            withTiming(1.03, {
              duration: motion.fast,
              easing: easeOut,
              reduceMotion: ReduceMotion.System,
            }),
          ),
        );
      })
      .onUpdate((event) => {
        const nextLensX = clamp(event.x - tabLensWidth / 2, minimumX, maximumX);
        tabLensX.set(nextLensX);
        tabSelectionPosition.set(
          tabSlotWidth > 0 ? (nextLensX - minimumX) / tabSlotWidth : activeTabIndex,
        );
      })
      .onEnd((event) => {
        const projectedX = clamp(tabLensX.get() + project(event.velocityX), minimumX, maximumX);
        const destinationIndex = Math.round((projectedX - minimumX) / tabSlotWidth);

        settleLens(destinationIndex, event.velocityX);
        scheduleOnRN(selectTab, destinationIndex);
      })
      .onFinalize((event, success) => {
        if (!success) {
          settleLens(activeTabIndex, event.velocityX);
        }

        cancelAnimation(tabLensVisibility);
        cancelAnimation(tabLensScale);
        tabLensVisibility.set(0);
        tabLensScale.set(
          withTiming(1, {
            duration: motion.fast,
            easing: easeOut,
            reduceMotion: ReduceMotion.System,
          }),
        );
      });
  }, [
    activeTabIndex,
    selectTab,
    tabLensMinimumX,
    tabLensScale,
    tabSelectionPosition,
    tabLensVisibility,
    tabLensWidth,
    tabLensX,
    tabSlotWidth,
  ]);

  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));

  const animatedTabLensStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabLensX.get() }, { scale: tabLensScale.get() }],
  }));

  const animatedTabLensFallbackStyle = useAnimatedStyle(() => ({
    opacity: tabLensVisibility.get(),
  }));

  const animatedTabLensProps = useAnimatedProps<GlassViewProps>(() => ({
    glassEffectStyle: {
      animate: true,
      animationDuration: motion.fast / 1000,
      style: tabLensVisibility.get() > 0.5 ? 'clear' : 'none',
    },
  }));

  const glassAvailable =
    process.env.EXPO_OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

  const tabButtons = tabDefinitions.map((tab, index) => {
    const isSelected = activeTabIndex === index;

    return (
      <Pressable
        accessibilityLabel={t(tab.labelKey)}
        accessibilityRole="tab"
        accessibilityState={{ selected: isSelected }}
        key={tab.name}
        onPress={() => selectTab(index)}
        style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
      >
        <TabIcon
          androidIcon={tab.androidIcon}
          index={index}
          iosIcon={tab.iosIcon}
          selectionPosition={tabSelectionPosition}
        />
        <TabLabel
          index={index}
          isSelected={isSelected}
          label={t(tab.labelKey)}
          selectionPosition={tabSelectionPosition}
        />
      </Pressable>
    );
  });

  const tabLens =
    tabLensWidth > 0 ? (
      glassAvailable ? (
        <AnimatedGlassView
          animatedProps={animatedTabLensProps}
          glassEffectStyle="none"
          isInteractive
          style={[styles.tabLens, { width: tabLensWidth }, animatedTabLensStyle]}
          tintColor={colors.transparent}
        >
          <Pressable
            accessible={false}
            onPress={() => selectTab(activeTabIndex)}
            style={styles.tabLensTouchTarget}
          />
        </AnimatedGlassView>
      ) : (
        <Animated.View
          style={[
            styles.tabLens,
            styles.tabLensFallback,
            { width: tabLensWidth },
            animatedTabLensStyle,
            animatedTabLensFallbackStyle,
          ]}
        >
          <Pressable
            accessible={false}
            onPress={() => selectTab(activeTabIndex)}
            style={styles.tabLensTouchTarget}
          />
        </Animated.View>
      )
    ) : null;

  return (
    <NavigationContent>
      <View style={styles.root}>
        <GestureDetector gesture={edgeSwipeGesture}>
          <View style={styles.viewport}>
            <Animated.View
              style={[
                styles.canvas,
                { width: pageWidth * tabDefinitions.length },
                animatedCanvasStyle,
              ]}
            >
              {tabDefinitions.map((tab) => {
                const route = state.routes.find((candidate) => candidate.name === tab.name);
                if (!route) {
                  return null;
                }

                const descriptor = descriptors[route.key];

                return (
                  <TabContext.Provider key={route.key} value={descriptor.options}>
                    <View collapsable={false} style={[styles.page, { width: pageWidth }]}>
                      {descriptor.render()}
                    </View>
                  </TabContext.Provider>
                );
              })}
            </Animated.View>
          </View>
        </GestureDetector>

        <View
          pointerEvents="box-none"
          style={[
            styles.tabBarContainer,
            { bottom: Math.max(spacing.lg, insets.bottom - spacing.sm) },
          ]}
        >
          <GestureDetector gesture={tabBarSelectionGesture}>
            <View onLayout={handleTabBarLayout} style={styles.tabBar}>
              {glassAvailable ? (
                <GlassView
                  colorScheme="dark"
                  glassEffectStyle="regular"
                  pointerEvents="none"
                  style={styles.tabBarGlassBackground}
                />
              ) : (
                <View
                  pointerEvents="none"
                  style={[styles.tabBarGlassBackground, styles.tabBarFallback]}
                />
              )}

              <View style={styles.tabButtons}>{tabButtons}</View>
              {tabLens}
            </View>
          </GestureDetector>
        </View>
      </View>
    </NavigationContent>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    flexDirection: 'row',
  },
  page: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  tabBar: {
    height: layout.floatingTabBarHeight,
    maxWidth: layout.maxContentWidth,
    width: '100%',
  },
  tabBarGlassBackground: {
    borderCurve: 'continuous',
    borderRadius: radius.full,
    bottom: spacing.none,
    left: spacing.none,
    position: 'absolute',
    right: spacing.none,
    top: spacing.none,
  },
  tabBarContainer: {
    alignItems: 'center',
    left: spacing.sm,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: spacing.sm,
  },
  tabBarFallback: {
    backgroundColor: colors.glassFallback,
    borderColor: colors.border,
    borderWidth: layout.borderWidth,
  },
  tabButtons: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xxs,
    justifyContent: 'center',
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  tabButtonPressed: {
    opacity: opacity.pressed,
  },
  tabIcon: {
    height: layout.iconMedium,
    position: 'relative',
    width: layout.iconMedium,
  },
  tabIconSelected: {
    ...StyleSheet.absoluteFill,
  },
  tabLens: {
    borderCurve: 'continuous',
    borderRadius: radius.full,
    bottom: spacing.sm,
    left: spacing.none,
    position: 'absolute',
    top: spacing.sm,
  },
  tabLensFallback: {
    backgroundColor: colors.transparent,
    borderColor: colors.borderStrong,
    borderWidth: layout.borderWidth,
  },
  tabLensTouchTarget: {
    flex: 1,
  },
  viewport: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
  },
});
