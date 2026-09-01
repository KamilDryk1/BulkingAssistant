import type {
  DailyAnalysisActionType,
  DailyAnalysisCategory,
  DailyAnalysisConfidence,
  DailyAnalysisPriority,
  DailyAnalysisProposedAction,
  DailyAnalysisResult,
  DailyAnalysisStatus,
} from './daily-analysis-types.ts';

const statuses = ['no_action', 'suggestion'] as const satisfies readonly DailyAnalysisStatus[];
const categories = [
  'none',
  'nutrition',
  'training',
  'recovery',
  'adherence',
  'activity',
] as const satisfies readonly DailyAnalysisCategory[];
const priorities = ['low', 'medium', 'high'] as const satisfies readonly DailyAnalysisPriority[];
const confidences = ['low', 'medium', 'high'] as const satisfies readonly DailyAnalysisConfidence[];
const actionTypes = [
  'none',
  'adjust_calories',
  'review_training',
  'review_schedule',
] as const satisfies readonly DailyAnalysisActionType[];

export const dailyAnalysisJsonSchema = {
  additionalProperties: false,
  properties: {
    category: { enum: categories, type: 'string' },
    confidence: { enum: confidences, type: 'string' },
    evidence: {
      items: { maxLength: 240, minLength: 1, type: 'string' },
      maxItems: 4,
      type: 'array',
    },
    message: { maxLength: 600, type: ['string', 'null'] },
    priority: { enum: priorities, type: 'string' },
    proposedAction: {
      additionalProperties: false,
      properties: {
        type: { enum: actionTypes, type: 'string' },
        unit: { enum: ['kcal', null], type: ['string', 'null'] },
        value: { maximum: 300, minimum: -300, type: ['integer', 'null'] },
      },
      required: ['type', 'value', 'unit'],
      type: 'object',
    },
    status: { enum: statuses, type: 'string' },
    title: { maxLength: 120, type: ['string', 'null'] },
  },
  required: [
    'status',
    'category',
    'priority',
    'title',
    'message',
    'evidence',
    'proposedAction',
    'confidence',
  ],
  type: 'object',
} as const;

export class DailyAnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyAnalysisValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], field: string) {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();

  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new DailyAnalysisValidationError(`${field} contains unexpected fields`);
  }
}

function isEnumValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function parseNullableText(value: unknown, field: string, maximumLength: number) {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new DailyAnalysisValidationError(`${field} must be a string or null`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new DailyAnalysisValidationError(`${field} has an invalid length`);
  }

  return normalized;
}

function parseEvidence(value: unknown) {
  if (!Array.isArray(value) || value.length > 4) {
    throw new DailyAnalysisValidationError('evidence must contain no more than four items');
  }

  return value.map((item) => {
    if (typeof item !== 'string' || !item.trim() || item.trim().length > 240) {
      throw new DailyAnalysisValidationError('evidence contains an invalid item');
    }

    return item.trim();
  });
}

function parseProposedAction(value: unknown): DailyAnalysisProposedAction {
  if (!isRecord(value) || !isEnumValue(actionTypes, value.type)) {
    throw new DailyAnalysisValidationError('proposedAction is invalid');
  }

  assertExactKeys(value, ['type', 'value', 'unit'], 'proposedAction');

  const action = {
    type: value.type,
    unit: value.unit,
    value: value.value,
  };

  if (action.type === 'adjust_calories') {
    if (
      action.unit !== 'kcal' ||
      typeof action.value !== 'number' ||
      !Number.isInteger(action.value) ||
      action.value === 0 ||
      Math.abs(action.value) > 300 ||
      Math.abs(action.value) % 50 !== 0
    ) {
      throw new DailyAnalysisValidationError('calorie adjustment is invalid');
    }

    return action as DailyAnalysisProposedAction;
  }

  if (action.unit !== null || action.value !== null) {
    throw new DailyAnalysisValidationError('non-calorie actions cannot contain a value or unit');
  }

  return action as DailyAnalysisProposedAction;
}

export function parseDailyAnalysisResult(value: unknown): DailyAnalysisResult {
  if (!isRecord(value)) {
    throw new DailyAnalysisValidationError('daily analysis result must be an object');
  }

  assertExactKeys(
    value,
    [
      'status',
      'category',
      'priority',
      'title',
      'message',
      'evidence',
      'proposedAction',
      'confidence',
    ],
    'daily analysis result',
  );

  if (!isEnumValue(statuses, value.status)) {
    throw new DailyAnalysisValidationError('status is invalid');
  }
  if (!isEnumValue(categories, value.category)) {
    throw new DailyAnalysisValidationError('category is invalid');
  }
  if (!isEnumValue(priorities, value.priority)) {
    throw new DailyAnalysisValidationError('priority is invalid');
  }
  if (!isEnumValue(confidences, value.confidence)) {
    throw new DailyAnalysisValidationError('confidence is invalid');
  }

  const title = parseNullableText(value.title, 'title', 120);
  const message = parseNullableText(value.message, 'message', 600);
  const evidence = parseEvidence(value.evidence);
  const proposedAction = parseProposedAction(value.proposedAction);

  if (value.status === 'no_action') {
    if (
      value.category !== 'none' ||
      value.priority !== 'low' ||
      title !== null ||
      message !== null ||
      evidence.length !== 0 ||
      proposedAction.type !== 'none'
    ) {
      throw new DailyAnalysisValidationError('no_action must be silent and contain no action');
    }
  } else if (
    value.category === 'none' ||
    title === null ||
    message === null ||
    evidence.length === 0
  ) {
    throw new DailyAnalysisValidationError(
      'suggestion must contain a category, copy, and evidence',
    );
  }

  if (proposedAction.type === 'adjust_calories' && value.category !== 'nutrition') {
    throw new DailyAnalysisValidationError('calorie adjustment requires the nutrition category');
  }

  return {
    category: value.category,
    confidence: value.confidence,
    evidence,
    message,
    priority: value.priority,
    proposedAction,
    status: value.status,
    title,
  };
}

export function parseDailyAnalysisJson(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new DailyAnalysisValidationError('daily analysis result is not valid JSON');
  }

  return parseDailyAnalysisResult(parsed);
}
