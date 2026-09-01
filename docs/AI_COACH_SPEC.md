# AI Coach architecture specification

## Scope and rollout

This document defines the shared AI architecture and the implemented Stage 1 daily analysis. Stage 2, the conversational AI Coach and its application tools, is intentionally design-only until it is explicitly approved.

AI augments the existing deterministic domains. It does not replace weight-unit conversion, rolling averages, Estimated 1RM, schedule resolution, workout completion statistics, or nutrition calculations.

## Existing domain boundaries reused by AI

- `src/features/today/nutrition-domain.ts` remains the only Mifflin–St Jeor, planned-training, goal, calorie, and macro calculator.
- `src/features/body/body-domain.ts` establishes the latest-measurement-per-local-day and rolling-average semantics.
- `src/features/progress/progress-domain.ts` establishes Epley Estimated 1RM and best-set semantics.
- `src/features/training/training-domain.ts` keeps recurring schedules separate from date-specific overrides.
- Workout sessions and their ordered exercise snapshots remain the historical source of truth after a session begins.
- TanStack Query remains the client server-state and mutation-invalidation layer.

## System architecture

```text
Expo / React Native
  -> authenticated Supabase Edge Function
    -> user-scoped Supabase reads protected by RLS
    -> deterministic compact context builder
    -> OpenAI Responses API with strict structured output
    -> validated result
    -> service-role persistence through constrained database RPCs
  -> TanStack Query cache
  -> existing Today and Body UI patterns
```

The OpenAI key and model configuration exist only in Supabase Edge Function secrets. No OpenAI call or privileged credential is present in the Expo bundle.

## Stage 1 flow

1. Today loads its normal target, schedule, activity, workout, and weight data.
2. After that core data is usable, a separate non-blocking query invokes `ensure-daily-analysis` with the local date and IANA time zone.
3. The Edge Function authenticates the caller from the bearer token and validates that the supplied date is the current date in the supplied time zone.
4. A service-only `claim_ai_daily_analysis` RPC creates or atomically claims the unique `(user_id, analysis_date)` row. Completed rows never call OpenAI again. Failed or abandoned rows are claimable only after their retry window.
5. The function reads only the authenticated user's allowed fitness data, then calculates compact metrics.
6. If no domain has enough reliable data, the row completes as `no_action` with the internal reason `insufficient_data` and OpenAI is not called.
7. Otherwise the official OpenAI SDK calls the Responses API with a strict JSON schema.
8. The response is validated again in application code before persistence.
9. `no_action` is stored and remains silent. An actionable row is returned to the client.
10. `claim_ai_daily_analysis_for_display` atomically sets `first_shown_at`, so rerenders, retries, and multiple devices cannot display the same suggestion repeatedly.
11. The suggestion form sheet can dismiss the row or explicitly accept a calorie adjustment. Training suggestions never mutate plans in Stage 1.

AI failure is isolated from normal application queries. A failure stores a sanitized error class and retry time; Today, Body, nutrition, and workouts continue normally.

## Database changes

### `profiles`

- `calorie_adjustment_calories integer not null default 0`: user-approved persistent offset, constrained independently from the deterministic formula.
- `goal_changed_at timestamptz`: lets context sufficiency distinguish a new goal from a stable goal.

### `nutrition_target_snapshots`

- `base_calories`: deterministic formula target after the existing goal adjustment and minimum safeguard.
- `calorie_adjustment_calories`: persistent offset copied into the snapshot.
- Existing `calories` remains the effective target used by the current UI.

```text
effective calories = base calories + persistent calorie adjustment
```

### `ai_daily_analyses`

One user-owned row per local date stores:

- processing state: `pending`, `failed`, `no_action`, or `suggestion`;
- internal outcome reason: `model`, `insufficient_data`, `disabled`, or `mock`;
- strict result fields: category, priority, title, message, evidence, proposed action, and confidence;
- diagnostics: context version, model, provider response ID, attempt count, sanitized error code, and retry timestamp;
- lifecycle: processing/completion, first shown, accepted, and dismissed timestamps;
- the IANA time zone used to validate the calendar date.

The table has RLS and direct authenticated access is read-only. Server processing and user interactions happen through narrow RPCs. `accept_ai_daily_analysis` locks the row, validates the proposed calorie delta, updates the profile adjustment once, and records acceptance in the same transaction.

## Daily analysis context v1

The context contains no user ID, email, auth record, or unrelated profile fields.

```text
version
analysisDate
locale
displayWeightUnit
goal
goalChangedRecently
trainingPlanChangedRecently
weight
  measurementCount, latest, current/previous 7-day averages,
  14/28-day changes, approximate weekly rate, presentation strings
strength
  completed sessions, recent/previous frequency,
  per-exercise session count, best-set and Estimated 1RM progression
adherence
  planned/completed/skipped sessions and completion rate
activities
  current/previous 7-day duration, change, and concise type totals
nutrition
  base calories, persistent adjustment, effective calories, macros
sufficiency
  reliable-domain flags and machine-readable reasons
```

Windows are 28 days for body weight, 42 days for strength, 28 days for adherence, and 14 days for additional activities. Values used in user-facing weight evidence are deterministically formatted in the selected unit and locale before reaching the model.

The current schedule is used to estimate historical adherence because the MVP does not yet version recurring schedule edits. A recent plan/schedule edit is therefore explicitly flagged and suppresses overconfident training conclusions.

## Structured output

The model must return every field in this stable shape:

```json
{
  "status": "no_action | suggestion",
  "category": "none | nutrition | training | recovery | adherence | activity",
  "priority": "low | medium | high",
  "title": "string | null",
  "message": "string | null",
  "evidence": ["up to four short strings"],
  "proposedAction": {
    "type": "none | adjust_calories | review_training | review_schedule",
    "value": "integer | null",
    "unit": "kcal | null"
  },
  "confidence": "low | medium | high"
}
```

Cross-field validation additionally enforces silent/null content for `no_action`, non-empty copy/evidence for suggestions, and conservative non-zero calorie deltas in 50 kcal increments. The model never supplies database IDs or mutation commands.

## Prompt and safety policy

Daily analysis instructions require conservative, trend-based interpretation; repeated comparable strength observations; broad evidence before declaring a program issue; and the user's current goal as context. The model is told that silence is preferred to manufactured advice, isolated measurements and sessions are noise, uncertainty must be acknowledged, medical diagnosis is out of scope, and nothing may be changed automatically.

Responses follow the profile locale. Internal schema values remain language-independent. Custom names are used as stored.

## Stage 1 UI and interaction policy

- The suggestion uses the established dark theme, Google Sans, lime accent, cards, large buttons, and Expo Router form-sheet navigation.
- All static copy uses English/Polish i18next keys. Model-generated title, message, and evidence are already generated in the selected locale.
- `no_action`, disabled, and insufficient-data results have no visible UI.
- A nutrition suggestion shows current and proposed effective targets. Only the explicit Apply button invokes the atomic acceptance RPC.
- Not now records dismissal. A shown, accepted, or dismissed row is not displayed again.
- Training, recovery, adherence, and activity suggestions explain and dismiss only. Stage 1 never changes a plan or schedule.
- Body exposes the active calorie adjustment and a manual reset to zero.

## Edge Function configuration

Required for live Stage 1:

- `OPENAI_API_KEY`
- `OPENAI_DAILY_ANALYSIS_MODEL` (initial recommendation: `gpt-5.6-terra`)

Reserved for Stage 2:

- `OPENAI_AGENT_MODEL` (initial recommendation: `gpt-5.6-terra`)

Optional development configuration:

- `AI_DAILY_ANALYSIS_MODE=live|mock|disabled`
- `AI_DAILY_ANALYSIS_MOCK_RESULT=<strict JSON result>`
- `AI_DAILY_ANALYSIS_LOG_CONTEXT=true` to inspect the compact context locally only
- `AI_DAILY_ANALYSIS_ALLOW_DEBUG_RESET=true` to allow an authenticated mock-mode reset for the current date

Model names are read once by Edge Function configuration code and the identifier used is persisted with every model-produced result.

## Logging and privacy

Normal logs contain an analysis ID and a sanitized event/error class, not tokens, API keys, full prompts, or full user context. Compact context logging is opt-in for local development and must not be enabled in production. OpenAI requests use `store: false`.

## Testing strategy

- Unit tests: local date/time-zone boundaries, weight windows, strength progression, adherence, activity summaries, insufficiency, strict response validation, prompt request construction with a mocked Responses client, and calorie adjustment math.
- pgTAP: uniqueness and claim idempotency, stale/failed retry claims, RLS isolation, one-time display claim, dismiss lifecycle, and atomic one-time calorie acceptance.
- Validation gate: strict TypeScript, Expo lint, unit tests, formatting, migration lint/pgTAP when local Supabase is available, Edge Function type check/serve where available, and Expo all-platform export.
- Manual states: AI disabled/failure, insufficient/no-action, actionable nutrition, actionable non-nutrition, dismiss, accept, reset, and duplicate same-day requests.

Tests inject a mock Responses client and never use a paid OpenAI call.

## Stage 2 design boundary (not implemented)

Stage 2 will reuse the same locale, unit, deterministic metric, validation, model-configuration, security, and audit conventions. It will add durable conversations/messages/tool runs and a bounded server-side tool registry.

Initial tool classes remain:

- read: today context/workout, plans, recent workouts, exercise progress, weight trend, nutrition target, exercise/activity search;
- explicit low-risk daily writes: today-only workout/exercise overrides, activity logs, and today's weight;
- persistent writes requiring confirmation: reusable plans, weekly schedule, and nutrition adjustment;
- destructive operations: excluded unless a later product requirement justifies a narrowly confirmed tool.

Every tool will derive the user from authentication, use stable IDs obtained from read/search tools, validate strict arguments, reuse the same underlying domain rules as the regular UI, and persist only user-visible content plus necessary tool audit metadata. It will never execute arbitrary SQL or store hidden reasoning.
