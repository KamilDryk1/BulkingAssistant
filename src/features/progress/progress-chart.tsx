import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { kilogramsToPounds } from '@/features/units/weight';
import { colors, layout, spacing } from '@/theme';
import type { AppLocale, WeightUnit } from '@/types/database';

import type { ProgressChartPoint } from './progress-types';

const chartWidth = 320;
const chartHeight = 150;
const chartTop = 8;
const chartBottom = 142;

type ProgressChartProps = {
  accessibilityLabel: string;
  locale: AppLocale;
  points: readonly ProgressChartPoint[];
  unit: WeightUnit;
};

function formatDate(dateKey: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    new Date(`${dateKey}T12:00:00`),
  );
}

export function ProgressChart({ accessibilityLabel, locale, points, unit }: ProgressChartProps) {
  const values = points.map((point) =>
    unit === 'lb' ? kilogramsToPounds(point.valueKg) : point.valueKg,
  );
  const timestamps = points.map((point) => Date.parse(point.occurredAt));
  const minimumValue = Math.min(...values);
  const maximumValue = Math.max(...values);
  const valueRange = Math.max(maximumValue - minimumValue, 0.5);
  const minimumTime = Math.min(...timestamps);
  const maximumTime = Math.max(...timestamps);
  const timeRange = maximumTime - minimumTime;
  const constantValues = maximumValue === minimumValue;
  const coordinates = values.map((value, index) => ({
    x:
      timeRange === 0
        ? points.length === 1
          ? chartWidth / 2
          : (index / (points.length - 1)) * chartWidth
        : ((timestamps[index] - minimumTime) / timeRange) * chartWidth,
    y: constantValues
      ? (chartTop + chartBottom) / 2
      : chartTop + ((maximumValue - value) / valueRange) * (chartBottom - chartTop),
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = coordinates.length
    ? `${linePath} L ${coordinates.at(-1)!.x} ${chartBottom} L ${coordinates[0].x} ${chartBottom} Z`
    : '';

  return (
    <View style={{ gap: spacing.sm }}>
      <Svg
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
        height={layout.emptyChartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width="100%"
      >
        <Defs>
          <LinearGradient id="progressArea" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.2} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[chartTop, (chartTop + chartBottom) / 2, chartBottom].map((y) => (
          <Line
            key={y}
            stroke={colors.border}
            strokeDasharray="4 6"
            strokeWidth={layout.borderWidth}
            x1={0}
            x2={chartWidth}
            y1={y}
            y2={y}
          />
        ))}
        {areaPath ? <Path d={areaPath} fill="url(#progressArea)" /> : null}
        {linePath ? (
          <Path
            d={linePath}
            fill="none"
            stroke={colors.primary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
        ) : null}
        {coordinates.map((point, index) => {
          const current = index === coordinates.length - 1;
          return (
            <Circle
              cx={point.x}
              cy={point.y}
              fill={current ? colors.primary : colors.surfaceElevated}
              key={points[index].sessionId}
              r={current ? 4 : 3}
              stroke={colors.primary}
              strokeWidth={2}
            />
          );
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText color="textMuted" variant="caption">
          {formatDate(points[0].date, locale)}
        </AppText>
        <AppText color="textMuted" variant="caption">
          {formatDate(points.at(-1)!.date, locale)}
        </AppText>
      </View>
    </View>
  );
}
