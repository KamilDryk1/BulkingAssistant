export type DailyAnalysisStatus = 'no_action' | 'suggestion';
export type DailyAnalysisCategory =
  'none' | 'nutrition' | 'training' | 'recovery' | 'adherence' | 'activity';
export type DailyAnalysisPriority = 'low' | 'medium' | 'high';
export type DailyAnalysisConfidence = 'low' | 'medium' | 'high';
export type DailyAnalysisActionType =
  'none' | 'adjust_calories' | 'review_training' | 'review_schedule';

export type DailyAnalysisProposedAction = {
  type: DailyAnalysisActionType;
  unit: 'kcal' | null;
  value: number | null;
};

export type DailyAnalysisResult = {
  category: DailyAnalysisCategory;
  confidence: DailyAnalysisConfidence;
  evidence: string[];
  message: string | null;
  priority: DailyAnalysisPriority;
  proposedAction: DailyAnalysisProposedAction;
  status: DailyAnalysisStatus;
  title: string | null;
};

export type WeightMetric = {
  display: string;
  kg: number;
};

export type WeightPeriodAverage = WeightMetric & {
  measurementCount: number;
};

export type DailyAnalysisWeightSummary = {
  change14Days: WeightMetric | null;
  change28Days: WeightMetric | null;
  current7DayAverage: WeightPeriodAverage | null;
  latest: (WeightMetric & { date: string }) | null;
  measurementCount: number;
  previous7DayAverage: WeightPeriodAverage | null;
  weeklyRate: WeightMetric | null;
};

export type DailyAnalysisExerciseSummary = {
  bestSetEarlier: { reps: number; weight: WeightMetric };
  bestSetRecent: { reps: number; weight: WeightMetric };
  direction: 'declining' | 'flat' | 'improving';
  earlierEstimatedOneRepMax: WeightMetric;
  firstSessionDate: string;
  lastSessionDate: string;
  name: string;
  percentChange: number;
  recentEstimatedOneRepMax: WeightMetric;
  sessionCount: number;
};

export type DailyAnalysisStrengthSummary = {
  comparableExerciseCount: number;
  completedSessionCount: number;
  exercises: DailyAnalysisExerciseSummary[];
  previousWeeklyFrequency: number;
  recentWeeklyFrequency: number;
};

export type DailyAnalysisAdherenceSummary = {
  completedSessions: number;
  completionRate: number | null;
  plannedSessions: number;
  skippedSessions: number;
};

export type DailyAnalysisActivitySummary = {
  current7DayDurationMinutes: number;
  durationChangeMinutes: number;
  previous7DayDurationMinutes: number;
  recent: {
    durationMinutes: number;
    intensity: string | null;
    logCount: number;
    name: string;
  }[];
};

export type DailyAnalysisNutritionSummary = {
  baseCalories: number;
  calorieAdjustment: number;
  effectiveCalories: number;
  macros: {
    carbohydrateGrams: number;
    fatGrams: number;
    proteinGrams: number;
  };
};

export type DailyAnalysisContext = {
  activities: DailyAnalysisActivitySummary;
  adherence: DailyAnalysisAdherenceSummary;
  analysisDate: string;
  displayWeightUnit: 'kg' | 'lb';
  goal: 'cut' | 'maintain' | 'gain';
  goalChangedRecently: boolean;
  locale: 'en' | 'pl';
  nutrition: DailyAnalysisNutritionSummary | null;
  strength: DailyAnalysisStrengthSummary;
  sufficiency: {
    activityTrendReady: boolean;
    adherenceReady: boolean;
    canAnalyze: boolean;
    reasons: string[];
    strengthTrendReady: boolean;
    weightTrendReady: boolean;
  };
  trainingPlanChangedRecently: boolean;
  version: 'daily-analysis-context-v1';
  weight: DailyAnalysisWeightSummary;
};

export type DailyAnalysisRecord = {
  accepted_at: string | null;
  analysis_date: string;
  analysis_time_zone: string;
  attempt_count: number;
  category: DailyAnalysisCategory | null;
  completed_at: string | null;
  confidence: DailyAnalysisConfidence | null;
  context_version: string | null;
  created_at: string;
  dismissed_at: string | null;
  error_code: string | null;
  evidence: unknown;
  first_shown_at: string | null;
  id: string;
  message: string | null;
  model: string | null;
  outcome_reason: 'model' | 'insufficient_data' | 'disabled' | 'mock' | null;
  priority: DailyAnalysisPriority | null;
  processing_started_at: string;
  processing_token: string;
  proposed_action: unknown;
  provider_response_id: string | null;
  retry_after: string | null;
  status: 'pending' | 'failed' | DailyAnalysisStatus;
  title: string | null;
  updated_at: string;
  user_id: string;
};

export type EnsureDailyAnalysisResponse = {
  analysis: DailyAnalysisRecord | null;
  outcome: 'completed' | 'existing' | 'failed';
};
