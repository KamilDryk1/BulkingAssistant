import type {
  ProgressChartPoint,
  ProgressMode,
  ProgressSessionPoint,
  ProgressSet,
  ProgressSetSource,
  ProgressSummary,
  ProgressTrend,
} from './progress-types.ts';

export const progressPeriodWeeks = 8;

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getProgressPeriodStartDate(dateKey: string) {
  return shiftDateKey(dateKey, -(progressPeriodWeeks * 7 - 1));
}

export function calculateEstimatedOneRepMax(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30);
}

function compareBestSet(left: ProgressSet, right: ProgressSet) {
  if (left.weightKg !== right.weightKg) {
    return left.weightKg - right.weightKg;
  }

  return left.reps - right.reps;
}

export function selectBestCompletedSet(sets: readonly ProgressSetSource[]) {
  return sets.reduce<ProgressSet | null>((best, set) => {
    if (!set.completedAt || set.reps <= 0 || set.weightKg < 0) {
      return best;
    }

    const candidate = { reps: set.reps, setId: set.setId, weightKg: set.weightKg };
    return !best || compareBestSet(candidate, best) > 0 ? candidate : best;
  }, null);
}

function selectEstimatedOneRepMaxSet(sets: readonly ProgressSetSource[]) {
  return sets.reduce<ProgressSet | null>((best, set) => {
    if (!set.completedAt || set.reps <= 0 || set.weightKg < 0) {
      return best;
    }

    const candidate = { reps: set.reps, setId: set.setId, weightKg: set.weightKg };
    if (!best) {
      return candidate;
    }

    const candidateEstimate = calculateEstimatedOneRepMax(candidate.weightKg, candidate.reps);
    const bestEstimate = calculateEstimatedOneRepMax(best.weightKg, best.reps);

    if (candidateEstimate !== bestEstimate) {
      return candidateEstimate > bestEstimate ? candidate : best;
    }

    return compareBestSet(candidate, best) > 0 ? candidate : best;
  }, null);
}

export function buildProgressSessionPoints(
  source: readonly ProgressSetSource[],
  exerciseId: string,
): ProgressSessionPoint[] {
  const sessions = new Map<
    string,
    { date: string; occurredAt: string; sets: ProgressSetSource[] }
  >();

  source
    .filter((set) => set.exerciseId === exerciseId)
    .forEach((set) => {
      const session = sessions.get(set.sessionId) ?? {
        date: set.sessionDate,
        occurredAt: set.sessionStartedAt,
        sets: [],
      };
      session.sets.push(set);
      sessions.set(set.sessionId, session);
    });

  return [...sessions.entries()]
    .flatMap(([sessionId, session]) => {
      const bestSet = selectBestCompletedSet(session.sets);
      const estimatedOneRepMaxSet = selectEstimatedOneRepMaxSet(session.sets);

      if (!bestSet || !estimatedOneRepMaxSet) {
        return [];
      }

      return [
        {
          bestSet,
          date: session.date,
          estimatedOneRepMaxKg: calculateEstimatedOneRepMax(
            estimatedOneRepMaxSet.weightKg,
            estimatedOneRepMaxSet.reps,
          ),
          estimatedOneRepMaxSet,
          occurredAt: session.occurredAt,
          sessionId,
        },
      ];
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

function toChartPoint(point: ProgressSessionPoint, mode: ProgressMode): ProgressChartPoint {
  const sourceSet = mode === 'estimatedOneRepMax' ? point.estimatedOneRepMaxSet : point.bestSet;

  return {
    date: point.date,
    occurredAt: point.occurredAt,
    reps: sourceSet.reps,
    sessionId: point.sessionId,
    valueKg: mode === 'estimatedOneRepMax' ? point.estimatedOneRepMaxKg : sourceSet.weightKg,
    weightKg: sourceSet.weightKg,
  };
}

function calculateTrend(
  points: readonly ProgressChartPoint[],
  mode: ProgressMode,
): ProgressTrend | null {
  if (points.length < 2) {
    return null;
  }

  const first = points[0];
  const current = points.at(-1)!;
  const weightChange = current.valueKg - first.valueKg;

  if (mode === 'bestSet' && Math.abs(weightChange) < Number.EPSILON) {
    const repsChange = current.reps - first.reps;
    return repsChange === 0 ? { kind: 'weight', valueKg: 0 } : { kind: 'reps', value: repsChange };
  }

  return { kind: 'weight', valueKg: weightChange };
}

export function getProgressSummary(
  sessionPoints: readonly ProgressSessionPoint[],
  mode: ProgressMode,
): ProgressSummary {
  const points = sessionPoints.map((point) => toChartPoint(point, mode));

  return {
    current: points.at(-1) ?? null,
    points,
    trend: calculateTrend(points, mode),
  };
}
