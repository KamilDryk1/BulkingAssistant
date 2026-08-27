import { type Href, usePathname, useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useCallback, useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const tabPaths = [
  '/',
  '/training',
  '/progress',
  '/body',
  '/settings',
] as const satisfies readonly Href[];

type TabPath = (typeof tabPaths)[number];

const edgeWidth = 24;
const activationDistance = 16;
const commitDistance = 48;
const commitVelocity = 650;
const verticalTolerance = 20;

export function EdgeSwipeNavigation({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const currentIndex = tabPaths.indexOf(pathname as TabPath);
  const previousPath = currentIndex > 0 ? tabPaths[currentIndex - 1] : undefined;
  const nextPath = currentIndex >= 0 ? tabPaths[currentIndex + 1] : undefined;

  const navigate = useCallback(
    (path: TabPath | undefined) => {
      if (path) {
        router.navigate(path);
      }
    },
    [router],
  );

  const edgeSwipeGesture = useMemo(() => {
    const fromLeftEdge = Gesture.Pan()
      .enabled(Boolean(previousPath))
      .hitSlop({ left: 0, width: edgeWidth })
      .activeOffsetX(activationDistance)
      .failOffsetY([-verticalTolerance, verticalTolerance])
      .onEnd((event) => {
        if (event.translationX >= commitDistance || event.velocityX >= commitVelocity) {
          navigate(previousPath);
        }
      })
      .runOnJS(true);

    const fromRightEdge = Gesture.Pan()
      .enabled(Boolean(nextPath))
      .hitSlop({ right: 0, width: edgeWidth })
      .activeOffsetX(-activationDistance)
      .failOffsetY([-verticalTolerance, verticalTolerance])
      .onEnd((event) => {
        if (event.translationX <= -commitDistance || event.velocityX <= -commitVelocity) {
          navigate(nextPath);
        }
      })
      .runOnJS(true);

    return Gesture.Simultaneous(fromLeftEdge, fromRightEdge);
  }, [navigate, nextPath, previousPath]);

  return <GestureDetector gesture={edgeSwipeGesture}>{children}</GestureDetector>;
}
