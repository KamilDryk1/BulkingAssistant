import type { ActivityDefinitionRow, AppLocale, ExerciseRow } from '@/types/database.ts';

import type {
  DailyScheduleOverride,
  ScheduleDraftItem,
  WeeklyScheduleItem,
} from './training-types.ts';

export function getExerciseDisplayName(exercise: ExerciseRow, locale: AppLocale) {
  if (exercise.is_custom) {
    return exercise.custom_name ?? '';
  }

  return locale === 'pl'
    ? (exercise.name_pl ?? exercise.name_en ?? '')
    : (exercise.name_en ?? exercise.name_pl ?? '');
}

export function getActivityDisplayName(activity: ActivityDefinitionRow, locale: AppLocale) {
  if (activity.is_custom) {
    return activity.custom_name ?? '';
  }

  return locale === 'pl'
    ? (activity.name_pl ?? activity.name_en ?? '')
    : (activity.name_en ?? activity.name_pl ?? '');
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getIsoWeekday(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).getDay();

  return weekday === 0 ? 7 : weekday;
}

export function getIsoWeekDateKeys(date = new Date()) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = getIsoWeekday(getLocalDateKey(current)) - 1;
  const monday = new Date(current);
  monday.setDate(current.getDate() - daysSinceMonday);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return getLocalDateKey(day);
  });
}

export function getSuggestedWorkoutDuration(exerciseCount: number) {
  const estimatedMinutes = 15 + exerciseCount * 8;
  return Math.min(120, Math.max(30, Math.round(estimatedMinutes / 5) * 5));
}

export function isScheduleDraftValid(items: readonly ScheduleDraftItem[]) {
  return items.every((item) => {
    if (item.itemType === 'rest') {
      return item.referenceId === null;
    }

    return (
      item.referenceId !== null &&
      Number.isInteger(item.durationMinutes) &&
      (item.durationMinutes ?? 0) > 0 &&
      (item.durationMinutes ?? 0) <= 1440 &&
      item.intensity !== null
    );
  });
}

export function addScheduleItem(items: readonly ScheduleDraftItem[], nextItem: ScheduleDraftItem) {
  if (nextItem.itemType === 'rest') {
    return [
      { durationMinutes: null, intensity: null, itemType: 'rest', referenceId: null },
    ] satisfies ScheduleDraftItem[];
  }

  const withoutRest = items.filter((item) => item.itemType !== 'rest');
  const duplicate = withoutRest.some(
    (item) => item.itemType === nextItem.itemType && item.referenceId === nextItem.referenceId,
  );

  return duplicate ? [...withoutRest] : [...withoutRest, nextItem];
}

export function addUniqueItem<T>(items: readonly T[], nextItem: T) {
  return items.includes(nextItem) ? [...items] : [...items, nextItem];
}

export function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);

  return nextItems;
}

export function resolveScheduleForDate(
  dateKey: string,
  weeklyItems: readonly WeeklyScheduleItem[],
  dailyOverride: DailyScheduleOverride | null,
) {
  if (dailyOverride?.date === dateKey) {
    return {
      items: [...dailyOverride.items],
      source: 'override' as const,
    };
  }

  const weekday = getIsoWeekday(dateKey);
  return {
    items: weeklyItems
      .filter((item) => item.weekday === weekday)
      .sort((left, right) => left.position - right.position)
      .map(({ durationMinutes, intensity, itemType, referenceId }) => ({
        durationMinutes,
        intensity,
        itemType,
        referenceId,
      })),
    source: 'weekly' as const,
  };
}

export function resolveScheduleForWeek(
  dateKeys: readonly string[],
  weeklyItems: readonly WeeklyScheduleItem[],
  dailyOverrides: readonly DailyScheduleOverride[],
) {
  return dateKeys.flatMap(
    (dateKey) =>
      resolveScheduleForDate(
        dateKey,
        weeklyItems,
        dailyOverrides.find((override) => override.date === dateKey) ?? null,
      ).items,
  );
}
