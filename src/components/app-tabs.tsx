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
  ReduceMotion,
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

import { AppText } from '@/components/app-text';
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
      translateX.set(-index * pageWidth);
      navigation.navigate(tab.name);
    },
    [navigation, pageWidth, translateX],
  );

  useLayoutEffect(() => {
    const activeTab = tabDefinitions[activeTabIndex];
    if (activeTab) {
      resetScreenScroll(activeTab.name);
    }

    cancelAnimation(translateX);
    translateX.set(-activeTabIndex * pageWidth);
  }, [activeTabIndex, pageWidth, translateX]);

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
        gestureStartX.set(translateX.get());
        scheduleOnRN(prepareTab, previousIndex);
      })
      .onUpdate((event) => {
        const previousPageX = -previousIndex * pageWidth;
        const nextX = gestureStartX.get() + Math.max(0, event.translationX);
        translateX.set(Math.min(previousPageX, nextX));
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
        gestureStartX.set(translateX.get());
        scheduleOnRN(prepareTab, nextIndex);
      })
      .onUpdate((event) => {
        const nextPageX = -nextIndex * pageWidth;
        const nextX = gestureStartX.get() + Math.min(0, event.translationX);
        translateX.set(Math.max(nextPageX, nextX));
      })
      .onEnd((event) => {
        const projectedX = event.translationX + project(event.velocityX);
        const shouldCommit = projectedX <= -pageWidth * commitRatio;
        settle(shouldCommit ? nextIndex : activeTabIndex, event.velocityX, shouldCommit);
      });

    return Gesture.Simultaneous(fromLeftEdge, fromRightEdge);
  }, [activeTabIndex, commitTab, gestureStartX, pageWidth, prepareTab, translateX]);

  const tabBarSelectionGesture = useMemo(() => {
    const minimumX = tabLensMinimumX;
    const maximumX = minimumX + tabSlotWidth * (tabDefinitions.length - 1);

    const settleLens = (index: number, velocity: number) => {
      'worklet';

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
        tabLensX.set(clamp(event.x - tabLensWidth / 2, minimumX, maximumX));
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
        tabLensX.set(clamp(event.x - tabLensWidth / 2, minimumX, maximumX));
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
      style: tabLensVisibility.get() > 0.5 ? 'regular' : 'none',
    },
  }));

  const glassAvailable =
    process.env.EXPO_OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

  const tabButtons = tabDefinitions.map((tab, index) => {
    const isSelected = activeTabIndex === index;
    const tintColor = isSelected ? colors.primary : colors.textMuted;

    return (
      <Pressable
        accessibilityLabel={t(tab.labelKey)}
        accessibilityRole="tab"
        accessibilityState={{ selected: isSelected }}
        key={tab.name}
        onPress={() => selectTab(index)}
        style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
      >
        <SymbolView
          name={{
            android: tab.androidIcon,
            ios: tab.iosIcon,
          }}
          resizeMode="scaleAspectFit"
          size={layout.iconMedium}
          tintColor={tintColor}
        />
        <AppText
          color={isSelected ? 'primary' : 'textMuted'}
          style={{
            fontFamily: isSelected ? fontFamilies.semibold : fontFamilies.medium,
            fontSize: typography.tab.fontSize,
          }}
          variant="tab"
        >
          {t(tab.labelKey)}
        </AppText>
      </Pressable>
    );
  });

  const tabLens =
    tabLensWidth > 0 ? (
      glassAvailable ? (
        <AnimatedGlassView
          animatedProps={animatedTabLensProps}
          colorScheme="dark"
          glassEffectStyle="none"
          isInteractive
          style={[styles.tabLens, { width: tabLensWidth }, animatedTabLensStyle]}
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
  tabLens: {
    borderCurve: 'continuous',
    borderRadius: radius.full,
    bottom: spacing.sm,
    left: spacing.none,
    position: 'absolute',
    top: spacing.sm,
  },
  tabLensFallback: {
    backgroundColor: colors.surfaceSelected,
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
