import type {
  ActivityIntensity,
  EquipmentCategory,
  MuscleGroup,
  WeightUnit,
} from '@/types/database.ts';

export type CoachToolKind = 'read' | 'daily_write' | 'persistent_write';

export type CoachToolName =
  | 'get_today_context'
  | 'get_today_workout'
  | 'get_workout_plan'
  | 'get_recent_workouts'
  | 'get_exercise_progress'
  | 'get_weight_trend'
  | 'get_nutrition_target'
  | 'search_exercises'
  | 'get_activity_definitions'
  | 'replace_exercise_for_today'
  | 'add_exercise_for_today'
  | 'remove_exercise_for_today'
  | 'change_today_workout'
  | 'add_activity'
  | 'edit_activity'
  | 'log_weight'
  | 'update_today_weight'
  | 'create_workout_plan'
  | 'update_workout_plan'
  | 'update_nutrition_adjustment';

export type CoachToolArguments =
  | { name: 'get_today_context'; arguments: Record<string, never> }
  | { name: 'get_today_workout'; arguments: Record<string, never> }
  | { name: 'get_workout_plan'; arguments: { workoutPlanId: string } }
  | { name: 'get_recent_workouts'; arguments: { limit: number } }
  | {
      name: 'get_exercise_progress';
      arguments: { exerciseId: string; sessionLimit: number };
    }
  | { name: 'get_weight_trend'; arguments: Record<string, never> }
  | { name: 'get_nutrition_target'; arguments: Record<string, never> }
  | {
      name: 'search_exercises';
      arguments: {
        equipment: EquipmentCategory | null;
        limit: number;
        muscleGroup: MuscleGroup | null;
        query: string | null;
      };
    }
  | {
      name: 'get_activity_definitions';
      arguments: { limit: number; query: string | null };
    }
  | {
      name: 'replace_exercise_for_today';
      arguments: {
        exerciseToReplaceId: string;
        replacementExerciseId: string;
        workoutPlanId: string;
      };
    }
  | {
      name: 'add_exercise_for_today';
      arguments: { afterExerciseId: string | null; exerciseId: string; workoutPlanId: string };
    }
  | {
      name: 'remove_exercise_for_today';
      arguments: { exerciseId: string; workoutPlanId: string };
    }
  | {
      name: 'change_today_workout';
      arguments: {
        durationMinutes: number;
        intensity: ActivityIntensity;
        workoutPlanId: string;
      };
    }
  | {
      name: 'add_activity';
      arguments: {
        activityDefinitionId: string;
        durationMinutes: number;
        intensity: ActivityIntensity;
      };
    }
  | {
      name: 'edit_activity';
      arguments: {
        activityLogId: string;
        durationMinutes: number;
        intensity: ActivityIntensity;
      };
    }
  | { name: 'log_weight'; arguments: { unit: WeightUnit; weight: number } }
  | { name: 'update_today_weight'; arguments: { unit: WeightUnit; weight: number } }
  | {
      name: 'create_workout_plan';
      arguments: { exerciseIds: string[]; name: string };
    }
  | {
      name: 'update_workout_plan';
      arguments: { exerciseIds: string[]; name: string; workoutPlanId: string };
    }
  | {
      name: 'update_nutrition_adjustment';
      arguments: { calorieAdjustment: number };
    };

export type CoachFunctionTool = {
  description: string;
  name: CoachToolName;
  parameters: Record<string, unknown>;
  strict: true;
  type: 'function';
};

const uuidPattern =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';
const uuidSchema = { pattern: uuidPattern, type: 'string' } as const;
const noArgumentsSchema = {
  additionalProperties: false,
  properties: {},
  required: [],
  type: 'object',
} as const;
const activityIntensitySchema = { enum: ['light', 'moderate', 'hard'], type: 'string' } as const;
const exerciseIdsSchema = {
  items: uuidSchema,
  maxItems: 30,
  minItems: 1,
  type: 'array',
} as const;

function objectSchema(
  properties: Record<string, unknown>,
  required: readonly string[] = Object.keys(properties),
) {
  return { additionalProperties: false, properties, required, type: 'object' } as const;
}

export const coachToolDefinitions = [
  {
    description:
      "Get a compact overview of today's goal, nutrition, resolved workout, activities, and weight.",
    name: 'get_today_context',
    parameters: noArgumentsSchema,
    strict: true,
    type: 'function',
  },
  {
    description:
      "Get today's resolved workout exercise order. Returns the active session snapshot after a workout has started.",
    name: 'get_today_workout',
    parameters: noArgumentsSchema,
    strict: true,
    type: 'function',
  },
  {
    description: 'Get one reusable workout plan and its ordered exercise IDs.',
    name: 'get_workout_plan',
    parameters: objectSchema({ workoutPlanId: uuidSchema }),
    strict: true,
    type: 'function',
  },
  {
    description: 'Get concise completed workout history, newest first.',
    name: 'get_recent_workouts',
    parameters: objectSchema({ limit: { maximum: 12, minimum: 1, type: 'integer' } }),
    strict: true,
    type: 'function',
  },
  {
    description:
      'Get recent sessions, best sets, and deterministic Epley estimated 1RM values for one exercise.',
    name: 'get_exercise_progress',
    parameters: objectSchema({
      exerciseId: uuidSchema,
      sessionLimit: { maximum: 12, minimum: 2, type: 'integer' },
    }),
    strict: true,
    type: 'function',
  },
  {
    description: 'Get the deterministic 28-day body-weight summary and rolling-average trend.',
    name: 'get_weight_trend',
    parameters: noArgumentsSchema,
    strict: true,
    type: 'function',
  },
  {
    description: 'Get the current base, adjustment, effective calorie target, macros, and goal.',
    name: 'get_nutrition_target',
    parameters: noArgumentsSchema,
    strict: true,
    type: 'function',
  },
  {
    description:
      'Search accessible predefined and custom exercises. Use this before write tools to obtain stable IDs.',
    name: 'search_exercises',
    parameters: objectSchema({
      equipment: {
        enum: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other', null],
        type: ['string', 'null'],
      },
      limit: { maximum: 20, minimum: 1, type: 'integer' },
      muscleGroup: {
        enum: ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'core', null],
        type: ['string', 'null'],
      },
      query: { maxLength: 80, type: ['string', 'null'] },
    }),
    strict: true,
    type: 'function',
  },
  {
    description:
      'Search accessible activity definitions. Use this before logging an activity to obtain a stable ID.',
    name: 'get_activity_definitions',
    parameters: objectSchema({
      limit: { maximum: 20, minimum: 1, type: 'integer' },
      query: { maxLength: 80, type: ['string', 'null'] },
    }),
    strict: true,
    type: 'function',
  },
  {
    description:
      "Replace one exercise in today's workout only. Requires an explicit user request and never changes the reusable plan.",
    name: 'replace_exercise_for_today',
    parameters: objectSchema({
      exerciseToReplaceId: uuidSchema,
      replacementExerciseId: uuidSchema,
      workoutPlanId: uuidSchema,
    }),
    strict: true,
    type: 'function',
  },
  {
    description:
      "Add one exercise to today's workout only. Requires an explicit user request and never changes the reusable plan.",
    name: 'add_exercise_for_today',
    parameters: objectSchema({
      afterExerciseId: { ...uuidSchema, type: ['string', 'null'] },
      exerciseId: uuidSchema,
      workoutPlanId: uuidSchema,
    }),
    strict: true,
    type: 'function',
  },
  {
    description:
      "Remove one exercise from today's workout only. Requires an explicit user request and never changes the reusable plan.",
    name: 'remove_exercise_for_today',
    parameters: objectSchema({ exerciseId: uuidSchema, workoutPlanId: uuidSchema }),
    strict: true,
    type: 'function',
  },
  {
    description:
      "Use a selected reusable plan for today's schedule only. Requires an explicit user request and never changes the weekly schedule.",
    name: 'change_today_workout',
    parameters: objectSchema({
      durationMinutes: { maximum: 1440, minimum: 1, type: 'integer' },
      intensity: activityIntensitySchema,
      workoutPlanId: uuidSchema,
    }),
    strict: true,
    type: 'function',
  },
  {
    description: 'Log an activity for today after an explicit user request.',
    name: 'add_activity',
    parameters: objectSchema({
      activityDefinitionId: uuidSchema,
      durationMinutes: { maximum: 1440, minimum: 1, type: 'integer' },
      intensity: activityIntensitySchema,
    }),
    strict: true,
    type: 'function',
  },
  {
    description: 'Edit a clearly identified activity logged today after an explicit user request.',
    name: 'edit_activity',
    parameters: objectSchema({
      activityLogId: uuidSchema,
      durationMinutes: { maximum: 1440, minimum: 1, type: 'integer' },
      intensity: activityIntensitySchema,
    }),
    strict: true,
    type: 'function',
  },
  {
    description:
      "Log today's weight in the supplied display unit after an explicit user request. Use update_today_weight if today already has a value.",
    name: 'log_weight',
    parameters: objectSchema({
      unit: { enum: ['kg', 'lb'], type: 'string' },
      weight: { exclusiveMaximum: 1103, exclusiveMinimum: 19, type: 'number' },
    }),
    strict: true,
    type: 'function',
  },
  {
    description:
      "Update today's primary weight entry in the supplied display unit after an explicit user request.",
    name: 'update_today_weight',
    parameters: objectSchema({
      unit: { enum: ['kg', 'lb'], type: 'string' },
      weight: { exclusiveMaximum: 1103, exclusiveMinimum: 19, type: 'number' },
    }),
    strict: true,
    type: 'function',
  },
  {
    description:
      'Propose creation of a reusable workout plan. The server stages it and requires UI confirmation before execution.',
    name: 'create_workout_plan',
    parameters: objectSchema({
      exerciseIds: exerciseIdsSchema,
      name: { maxLength: 80, minLength: 1, type: 'string' },
    }),
    strict: true,
    type: 'function',
  },
  {
    description:
      'Propose a permanent replacement of a reusable workout plan name and exercise order. Always requires UI confirmation.',
    name: 'update_workout_plan',
    parameters: objectSchema({
      exerciseIds: exerciseIdsSchema,
      name: { maxLength: 80, minLength: 1, type: 'string' },
      workoutPlanId: uuidSchema,
    }),
    strict: true,
    type: 'function',
  },
  {
    description:
      'Propose a persistent calorie adjustment. Always requires UI confirmation and cannot alter profile/BMR inputs.',
    name: 'update_nutrition_adjustment',
    parameters: objectSchema({
      calorieAdjustment: {
        maximum: 600,
        minimum: -600,
        multipleOf: 50,
        type: 'integer',
      },
    }),
    strict: true,
    type: 'function',
  },
] as const satisfies readonly CoachFunctionTool[];

const readTools = new Set<CoachToolName>([
  'get_today_context',
  'get_today_workout',
  'get_workout_plan',
  'get_recent_workouts',
  'get_exercise_progress',
  'get_weight_trend',
  'get_nutrition_target',
  'search_exercises',
  'get_activity_definitions',
]);

const dailyWriteTools = new Set<CoachToolName>([
  'replace_exercise_for_today',
  'add_exercise_for_today',
  'remove_exercise_for_today',
  'change_today_workout',
  'add_activity',
  'edit_activity',
  'log_weight',
  'update_today_weight',
]);

const toolNames = new Set(coachToolDefinitions.map((tool) => tool.name));
const equipmentValues = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'] as const;
const muscleGroupValues = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core',
] as const;
const intensityValues = ['light', 'moderate', 'hard'] as const;
const weightUnitValues = ['kg', 'lb'] as const;

export class CoachToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoachToolValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseObject(value: unknown, keys: readonly string[]) {
  if (!isRecord(value)) {
    throw new CoachToolValidationError('Tool arguments must be an object');
  }

  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new CoachToolValidationError('Tool arguments contain unexpected fields');
  }

  return value;
}

function parseUuid(value: unknown, field: string) {
  if (typeof value !== 'string' || !new RegExp(uuidPattern).test(value)) {
    throw new CoachToolValidationError(`${field} must be a UUID`);
  }

  return value;
}

function parseText(value: unknown, field: string, maximumLength: number) {
  if (typeof value !== 'string') {
    throw new CoachToolValidationError(`${field} must be text`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new CoachToolValidationError(`${field} has an invalid length`);
  }

  return normalized;
}

function parseNullableText(value: unknown, field: string, maximumLength: number) {
  return value === null ? null : parseText(value, field, maximumLength);
}

function parseInteger(value: unknown, field: string, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new CoachToolValidationError(`${field} must be an integer from ${minimum} to ${maximum}`);
  }

  return value as number;
}

function parseNumber(value: unknown, field: string, minimum: number, maximum: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new CoachToolValidationError(`${field} must be a number from ${minimum} to ${maximum}`);
  }

  return value;
}

function parseEnum<T extends string>(value: unknown, field: string, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new CoachToolValidationError(`${field} is invalid`);
  }

  return value as T;
}

function parseNullableEnum<T extends string>(value: unknown, field: string, values: readonly T[]) {
  return value === null ? null : parseEnum(value, field, values);
}

function parseExerciseIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) {
    throw new CoachToolValidationError('exerciseIds must contain between 1 and 30 IDs');
  }

  const ids = value.map((item) => parseUuid(item, 'exerciseIds'));
  if (new Set(ids).size !== ids.length) {
    throw new CoachToolValidationError('exerciseIds cannot contain duplicates');
  }

  return ids;
}

function parseEmptyArguments(value: unknown) {
  parseObject(value, []);
  return {} as Record<string, never>;
}

export function isCoachToolName(value: string): value is CoachToolName {
  return toolNames.has(value as CoachToolName);
}

export function getCoachToolKind(name: CoachToolName): CoachToolKind {
  if (readTools.has(name)) {
    return 'read';
  }

  return dailyWriteTools.has(name) ? 'daily_write' : 'persistent_write';
}

export function parseCoachToolArguments(name: string, json: string): CoachToolArguments {
  if (!isCoachToolName(name)) {
    throw new CoachToolValidationError('Unknown Coach tool');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new CoachToolValidationError('Tool arguments are not valid JSON');
  }

  switch (name) {
    case 'get_today_context':
    case 'get_today_workout':
    case 'get_weight_trend':
    case 'get_nutrition_target':
      return { arguments: parseEmptyArguments(parsed), name };
    case 'get_workout_plan': {
      const value = parseObject(parsed, ['workoutPlanId']);
      return {
        arguments: { workoutPlanId: parseUuid(value.workoutPlanId, 'workoutPlanId') },
        name,
      };
    }
    case 'get_recent_workouts': {
      const value = parseObject(parsed, ['limit']);
      return { arguments: { limit: parseInteger(value.limit, 'limit', 1, 12) }, name };
    }
    case 'get_exercise_progress': {
      const value = parseObject(parsed, ['exerciseId', 'sessionLimit']);
      return {
        arguments: {
          exerciseId: parseUuid(value.exerciseId, 'exerciseId'),
          sessionLimit: parseInteger(value.sessionLimit, 'sessionLimit', 2, 12),
        },
        name,
      };
    }
    case 'search_exercises': {
      const value = parseObject(parsed, ['equipment', 'limit', 'muscleGroup', 'query']);
      return {
        arguments: {
          equipment: parseNullableEnum(value.equipment, 'equipment', equipmentValues),
          limit: parseInteger(value.limit, 'limit', 1, 20),
          muscleGroup: parseNullableEnum(value.muscleGroup, 'muscleGroup', muscleGroupValues),
          query: parseNullableText(value.query, 'query', 80),
        },
        name,
      };
    }
    case 'get_activity_definitions': {
      const value = parseObject(parsed, ['limit', 'query']);
      return {
        arguments: {
          limit: parseInteger(value.limit, 'limit', 1, 20),
          query: parseNullableText(value.query, 'query', 80),
        },
        name,
      };
    }
    case 'replace_exercise_for_today': {
      const value = parseObject(parsed, [
        'exerciseToReplaceId',
        'replacementExerciseId',
        'workoutPlanId',
      ]);
      return {
        arguments: {
          exerciseToReplaceId: parseUuid(value.exerciseToReplaceId, 'exerciseToReplaceId'),
          replacementExerciseId: parseUuid(value.replacementExerciseId, 'replacementExerciseId'),
          workoutPlanId: parseUuid(value.workoutPlanId, 'workoutPlanId'),
        },
        name,
      };
    }
    case 'add_exercise_for_today': {
      const value = parseObject(parsed, ['afterExerciseId', 'exerciseId', 'workoutPlanId']);
      return {
        arguments: {
          afterExerciseId:
            value.afterExerciseId === null
              ? null
              : parseUuid(value.afterExerciseId, 'afterExerciseId'),
          exerciseId: parseUuid(value.exerciseId, 'exerciseId'),
          workoutPlanId: parseUuid(value.workoutPlanId, 'workoutPlanId'),
        },
        name,
      };
    }
    case 'remove_exercise_for_today': {
      const value = parseObject(parsed, ['exerciseId', 'workoutPlanId']);
      return {
        arguments: {
          exerciseId: parseUuid(value.exerciseId, 'exerciseId'),
          workoutPlanId: parseUuid(value.workoutPlanId, 'workoutPlanId'),
        },
        name,
      };
    }
    case 'change_today_workout': {
      const value = parseObject(parsed, ['durationMinutes', 'intensity', 'workoutPlanId']);
      return {
        arguments: {
          durationMinutes: parseInteger(value.durationMinutes, 'durationMinutes', 1, 1440),
          intensity: parseEnum(value.intensity, 'intensity', intensityValues),
          workoutPlanId: parseUuid(value.workoutPlanId, 'workoutPlanId'),
        },
        name,
      };
    }
    case 'add_activity': {
      const value = parseObject(parsed, ['activityDefinitionId', 'durationMinutes', 'intensity']);
      return {
        arguments: {
          activityDefinitionId: parseUuid(value.activityDefinitionId, 'activityDefinitionId'),
          durationMinutes: parseInteger(value.durationMinutes, 'durationMinutes', 1, 1440),
          intensity: parseEnum(value.intensity, 'intensity', intensityValues),
        },
        name,
      };
    }
    case 'edit_activity': {
      const value = parseObject(parsed, ['activityLogId', 'durationMinutes', 'intensity']);
      return {
        arguments: {
          activityLogId: parseUuid(value.activityLogId, 'activityLogId'),
          durationMinutes: parseInteger(value.durationMinutes, 'durationMinutes', 1, 1440),
          intensity: parseEnum(value.intensity, 'intensity', intensityValues),
        },
        name,
      };
    }
    case 'log_weight':
    case 'update_today_weight': {
      const value = parseObject(parsed, ['unit', 'weight']);
      return {
        arguments: {
          unit: parseEnum(value.unit, 'unit', weightUnitValues),
          weight: parseNumber(value.weight, 'weight', 20, 1102),
        },
        name,
      };
    }
    case 'create_workout_plan': {
      const value = parseObject(parsed, ['exerciseIds', 'name']);
      return {
        arguments: {
          exerciseIds: parseExerciseIds(value.exerciseIds),
          name: parseText(value.name, 'name', 80),
        },
        name,
      };
    }
    case 'update_workout_plan': {
      const value = parseObject(parsed, ['exerciseIds', 'name', 'workoutPlanId']);
      return {
        arguments: {
          exerciseIds: parseExerciseIds(value.exerciseIds),
          name: parseText(value.name, 'name', 80),
          workoutPlanId: parseUuid(value.workoutPlanId, 'workoutPlanId'),
        },
        name,
      };
    }
    case 'update_nutrition_adjustment': {
      const value = parseObject(parsed, ['calorieAdjustment']);
      const calorieAdjustment = parseInteger(
        value.calorieAdjustment,
        'calorieAdjustment',
        -600,
        600,
      );
      if (calorieAdjustment % 50 !== 0) {
        throw new CoachToolValidationError('calorieAdjustment must use 50 kcal increments');
      }
      return { arguments: { calorieAdjustment }, name };
    }
  }
}
