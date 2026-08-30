import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { colors, layout, radius } from '@/theme';
import type { ScheduleItemType } from '@/types/database';

type ScheduleItemIconProps = {
  activitySlug?: string | null;
  itemType: ScheduleItemType;
};

const glyphSize = 26;
const strokeWidth = 1.8;

function ActivityGlyph({ slug }: { slug?: string | null }) {
  switch (slug) {
    case 'boxing':
      return (
        <>
          <Path d="M7.2 13V8.4a1.8 1.8 0 0 1 3.6 0v2.1" />
          <Path d="M10.8 9V6.8a1.8 1.8 0 0 1 3.6 0V10" />
          <Path d="M14.4 9V7.5a1.7 1.7 0 0 1 3.4 0v5.7c0 3.4-2.3 5.6-5.5 5.6H9.8A3.8 3.8 0 0 1 6 15v-1.7a1.8 1.8 0 0 1 3.6 0V15" />
          <Path d="M8.1 18.5v2h8.1v-2" />
        </>
      );
    case 'muay-thai':
      return (
        <>
          <Circle cx="12" cy="4.5" r="1.6" />
          <Path d="m11.2 7-2.4 3.4-3.2 1.4M12.8 7l2.5 2.6 2.9-1.7" />
          <Path d="m11.4 7.3 1.2 6.2-3.3 2.4-1.8 4" />
          <Path d="m12.6 13.5 3.2 1.6 2.1 3.8" />
          <Path d="m15.3 9.6 1 2.4" />
        </>
      );
    case 'kickboxing':
      return (
        <>
          <Circle cx="9.2" cy="4.5" r="1.6" />
          <Path d="m9.5 7 1.2 6.2-3.1 3-1 4" />
          <Path d="m10.7 13.2 3.6 1.1 5.1-2.4" />
          <Path d="m9.8 8-3 2.6-2.2-1.3M10.3 8.1l3 1.6 2.2-1.8" />
          <Path d="m18.9 11.9 1.6.8" />
        </>
      );
    case 'mma':
      return (
        <>
          <Polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" />
          <Path d="m8 9 2.2 2.2L8 15M16 9l-2.2 2.2L16 15M10.2 11.2h3.6" />
        </>
      );
    case 'bjj':
      return (
        <>
          <Path d="M4 8.2h16v5.6H4z" />
          <Path d="m10.1 8.2 3.8 5.6M13.9 8.2l-3.8 5.6" />
          <Path d="m10.2 13.8-2.4 6M13.8 13.8l2.4 6" />
          <Path d="M5.8 10.9h3M15.2 10.9h3" />
        </>
      );
    case 'running':
      return (
        <>
          <Circle cx="14.6" cy="4.2" r="1.6" />
          <Path d="m12.7 7-3 4.1-4.1 1.2" />
          <Path d="m11 9.2 4.2 3.3 3.2-.8" />
          <Path d="m13.3 11-2.4 4.4-4.5 4.1M10.9 15.4l4.1 1.2 2.3 3.3" />
        </>
      );
    case 'cycling':
      return (
        <>
          <Circle cx="6.2" cy="16.8" r="3.2" />
          <Circle cx="17.8" cy="16.8" r="3.2" />
          <Path d="m6.2 16.8 4-7 3.3 7H6.2l4.4-4.2h5.2" />
          <Path d="m14.2 7.2 2.2 2.4h2.2M8.6 7.2h3" />
        </>
      );
    case 'swimming':
      return (
        <>
          <Circle cx="16.8" cy="7.2" r="1.7" />
          <Path d="m4 12 4.2-2.5 4.4 2.4 3.4-1.7" />
          <Path d="M3 15.2c1.5 0 1.5 1.2 3 1.2s1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2" />
          <Path d="M3 19c1.5 0 1.5 1.2 3 1.2S7.5 19 9 19s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2" />
        </>
      );
    case 'walking':
      return (
        <>
          <Circle cx="12.7" cy="4.2" r="1.6" />
          <Path d="m12.1 7-2.2 5 2.8 3.2-1.2 5.2" />
          <Path d="m10.6 9.1-3 2.6M11.1 13.3l-3.3 5.5M12 8.6l3.6 2.7" />
        </>
      );
    case 'hiking':
      return (
        <>
          <Path d="m3 19 5.6-8.2 2.4 3.1 2.2-3 7.8 8.1H3Z" />
          <Path d="m6.8 13.5 1.8-2.7 1.3 1.7M16.8 6v13M15.2 7.6l1.6-1.6 1.6 1.6" />
        </>
      );
    case 'football':
      return (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Polygon points="12,8 15.3,10.4 14,14.2 10,14.2 8.7,10.4" />
          <Path d="m12 8 .2-5M15.3 10.4l4.4-1.5M14 14.2l2.7 4M10 14.2l-2.7 4M8.7 10.4 4.3 8.9" />
        </>
      );
    case 'basketball':
      return (
        <>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M3.2 10.2h17.6M12 3v18M6 5.3c4 3.7 8 8.7 12 13.4M18 5.3c-4 3.7-8 8.7-12 13.4" />
        </>
      );
    case 'tennis':
      return (
        <>
          <Ellipse cx="9.2" cy="8.8" rx="4.5" ry="6" transform="rotate(38 9.2 8.8)" />
          <Path d="m12.8 13.4 6.1 6.1M16.5 17.1l-2.1 2.1" />
          <Circle cx="19" cy="5" r="1.7" />
          <Path d="m5.3 6.4 7.8 5.4M6.1 11.8l6.2-8" />
        </>
      );
    case 'rowing':
      return (
        <>
          <Path d="M4 15h16l-2.8 4H7L4 15Z" />
          <Path d="m6 5 10.5 11M18 5 7.5 16" />
          <Ellipse cx="4.8" cy="4.2" rx="1.3" ry="2.3" transform="rotate(-42 4.8 4.2)" />
          <Ellipse cx="19.2" cy="4.2" rx="1.3" ry="2.3" transform="rotate(42 19.2 4.2)" />
          <Path d="M3 21c1.7 0 1.7-1 3.4-1s1.7 1 3.4 1 1.7-1 3.4-1 1.7 1 3.4 1 1.7-1 3.4-1" />
        </>
      );
    default:
      return (
        <>
          <Circle cx="12" cy="12" r="8.5" />
          <Polyline points="5.5,12 8.4,12 10.2,8.2 13.1,15.8 15,12 18.5,12" />
        </>
      );
  }
}

function ScheduleGlyph({ activitySlug, itemType }: ScheduleItemIconProps) {
  if (itemType === 'workout') {
    return (
      <>
        <Line x1="3" x2="3" y1="9" y2="15" />
        <Rect height="10" rx="1" width="3" x="5" y="7" />
        <Line x1="8" x2="16" y1="12" y2="12" />
        <Rect height="10" rx="1" width="3" x="16" y="7" />
        <Line x1="21" x2="21" y1="9" y2="15" />
      </>
    );
  }

  if (itemType === 'rest') {
    return <Path d="M18.7 15.9A7.8 7.8 0 0 1 8.1 5.3a7.8 7.8 0 1 0 10.6 10.6Z" />;
  }

  return <ActivityGlyph slug={activitySlug} />;
}

export function ScheduleItemIcon({ activitySlug, itemType }: ScheduleItemIconProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        alignItems: 'center',
        backgroundColor: colors.primaryMuted,
        borderCurve: 'continuous',
        borderRadius: radius.md,
        flexShrink: 0,
        height: layout.iconLarge,
        justifyContent: 'center',
        width: layout.iconLarge,
      }}
    >
      <Svg height={glyphSize} viewBox="0 0 24 24" width={glyphSize}>
        <G
          fill="none"
          stroke={colors.primary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        >
          <ScheduleGlyph activitySlug={activitySlug} itemType={itemType} />
        </G>
      </Svg>
    </View>
  );
}
