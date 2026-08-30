import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { kilogramsToPounds } from '@/features/units/weight';
import { colors, layout, spacing } from '@/theme';
import type { AppLocale, WeightUnit } from '@/types/database';

import type { WeightTrendPoint } from './body-types';

const chartWidth = 320;
const chartHeight = 150;
const chartTop = 8;
const chartBottom = 142;

type ChartCoordinate = {
  x: number;
  y: number;
};

type WeightTrendChartProps = {
  accessibilityLabel: string;
  locale: AppLocale;
  points: readonly WeightTrendPoint[];
  unit: WeightUnit;
};

function formatDate(dateKey: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    new Date(`${dateKey}T12:00:00`),
  );
}

export function WeightTrendChart({
  accessibilityLabel,
  locale,
  points,
  unit,
}: WeightTrendChartProps) {
  const displayValues = points.map((point) =>
    unit === 'lb' ? kilogramsToPounds(point.averageWeightKg) : point.averageWeightKg,
  );
  const minimum = Math.min(...displayValues);
  const maximum = Math.max(...displayValues);
  const range = Math.max(maximum - minimum, 0.5);
  const constantValues = maximum === minimum;
  const coordinates: ChartCoordinate[] = displayValues.map((value, index) => ({
    x: points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth,
    y: constantValues
      ? (chartTop + chartBottom) / 2
      : chartTop + ((maximum - value) / range) * (chartBottom - chartTop),
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = coordinates.length
    ? `${linePath} L ${coordinates.at(-1)!.x} ${chartBottom} L ${coordinates[0].x} ${chartBottom} Z`
    : '';
  const lastPoint = coordinates.at(-1);

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
          <LinearGradient id="weightTrendArea" x1="0" x2="0" y1="0" y2="1">
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
        {areaPath ? <Path d={areaPath} fill="url(#weightTrendArea)" /> : null}
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
        {lastPoint ? (
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            fill={colors.primary}
            r={4}
            stroke={colors.surfaceElevated}
            strokeWidth={2}
          />
        ) : null}
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
