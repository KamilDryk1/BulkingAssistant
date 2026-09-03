# AI Coach architecture specification

## Scope and rollout

This document defines the shared AI architecture, the implemented Stage 1 daily analysis, and the implemented Stage 2 conversational Coach with controlled application tools.

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
    -> deterministic compact context builders and domain services
    -> OpenAI Responses API with strict structured output or function tools
    -> validated result / bounded tool execution
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

## Stage 2 flow

1. The user opens Coach from Today, returns to the latest durable conversation, starts a new one, or opens it with a Daily Analysis suggestion attached.
2. The `ai-coach` Edge Function verifies the bearer token and validates that the supplied local date matches the current date in the supplied IANA time zone.
3. The service-only `begin_ai_coach_turn` RPC creates or claims the conversation and persists the user-visible message with a client request ID. Duplicate requests are idempotent; a failed/stale turn can resume with the same message.
4. The function loads at most 24 recent visible messages. It adds only locale, display unit, current date, and optional compact Stage 1 suggestion metadata to the instructions.
5. The Responses API runs with `store: false`, `parallel_tool_calls: false`, and at most six tool iterations. Encrypted reasoning state may pass in memory between calls during that single turn but is never persisted.
6. Every requested function name and JSON argument object is validated against the local strict registry before dispatch.
7. Read tools return compact domain data. Explicit low-risk writes update only the current date/session. Persistent writes are staged in `ai_tool_runs` and tool access is then disabled for the confirmation response.
8. Apply/Cancel acts on the audited pending row. Apply revalidates current ownership/data before executing; Cancel performs no domain mutation. Both write a visible assistant acknowledgement.
9. TanStack Query replaces the conversation bundle and invalidates affected Today, Training, Workout, Body, Progress, and Profile caches.

The database is the durable source for conversation history. Provider conversation storage and `previous_response_id` are intentionally not required, so app restart, device restart, and provider retention settings do not affect visible history.

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

### `ai_conversations`, `ai_messages`, and `ai_tool_runs`

- `ai_conversations` owns the user, optional Stage 1 source analysis, title, processing lease/token, and sanitized failure state.
- `ai_messages` stores only visible `user`/`assistant` content. A unique client request ID makes send retries idempotent.
- `ai_tool_runs` stores function name, class, validated arguments, compact result, status, confirmation copy, high-level change, and timestamps needed for recovery/audit.

Authenticated clients have RLS-protected read access only. Conversation processing writes are performed through service-only claim/complete/fail RPCs after the Edge Function derives the user from Supabase Auth. Hidden reasoning and raw prompts are not stored.

### Today-only workout exercise overrides

`daily_workout_exercise_overrides` and ordered child rows store a user/date/plan-specific exercise list. The reusable `workout_plan_exercises` rows remain unchanged.

- Before a workout starts, Coach updates this dated list through `replace_daily_workout_exercises`.
- `start_workout_session` snapshots the dated list when present, otherwise the reusable plan.
- After a session starts, `replace_active_workout_session_exercises` updates only the session snapshot.
- An exercise with recorded sets cannot be removed, preventing completed work from being silently reattributed or deleted.

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

## Stage 2 tool inventory and confirmation policy

All 20 tools use strict JSON schemas with `additionalProperties: false`. Every property is required; nullable values are represented explicitly. UUIDs, limits, enums, array uniqueness, weight ranges, and 50 kcal increments are validated again at runtime.

The provider schemas use the documented Structured Outputs subset. Exercise-array uniqueness is enforced only by the runtime validator and database constraints, not by an unsupported `uniqueItems` provider keyword.

| Class                | Tools                                                                                                                                                                                                    | Execution policy                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Read                 | `get_today_context`, `get_today_workout`, `get_workout_plan`, `get_recent_workouts`, `get_exercise_progress`, `get_weight_trend`, `get_nutrition_target`, `search_exercises`, `get_activity_definitions` | Immediate; no confirmation                                                                                           |
| Low-risk daily write | `replace_exercise_for_today`, `add_exercise_for_today`, `remove_exercise_for_today`, `change_today_workout`, `add_activity`, `edit_activity`, `log_weight`, `update_today_weight`                        | Immediate only when the latest message explicitly requests the action; scope is current local date or active session |
| Persistent write     | `create_workout_plan`, `update_workout_plan`, `update_nutrition_adjustment`                                                                                                                              | Stage an audited proposal, show exact Apply/Cancel card, and execute only after Apply                                |
| Destructive          | none                                                                                                                                                                                                     | Broad deletion is not exposed to the model                                                                           |

A question or recommendation request never grants mutation authority. Ambiguous commands cause a concise clarification. A persistent tool call itself does not mutate; the server returns `confirmationRequired`, stops further tool use for the turn, and links the pending audit row to the assistant confirmation card.

Confirmed plan updates reuse `save_workout_plan`. Confirmed plan creation uses a wrapper that assigns the tool-run UUID as the plan ID before calling the same RPC, making crash recovery idempotent. Today schedule changes reuse `replace_daily_schedule_override`; activities, weights, and profile adjustments use the same RLS-protected domain tables as their regular UI services. Weight input is converted to canonical kilograms at the boundary. Progress and weight tools reuse deterministic Estimated 1RM and rolling-average functions.

The first inventory deliberately excludes permanent weekly-schedule changes, goal changes, plan deletion, and stored-data deletion. They require separate product design and narrower confirmation semantics.

## Stage 2 UI and navigation

- Coach is a full-screen Expo Router route opened from a dedicated card on Today; no sixth bottom tab is added.
- When the Stage 2 exercise-override tables have not been deployed yet, Today keeps using the existing workout templates and disables its Coach entry with a setup message. Only missing-table responses for those tables are treated as unavailable Stage 2; authentication, network, permission, and other schema errors remain visible.
- The screen uses a virtualized message list, compact empty-state prompts, multiline composer, send/loading/error/retry states, conversation history, and New conversation.
- Returning from Today restores the most recently updated conversation. Conversation messages survive logout/login and device restart because they are stored in Supabase.
- Persistent actions render Apply and Cancel directly below the proposing assistant message, including terminal applied/failed/cancelled state.
- Daily Suggestion exposes Discuss with Coach. It opens a new conversation with `source_analysis_id`; the suggestion is visible as context, and supporting facts are still fetched through read tools on demand.
- All static interface copy is keyed in English and Polish. Model instructions use the profile locale; custom names remain untouched.

## Edge Function configuration

Required for live Stage 1:

- `OPENAI_API_KEY`
- `OPENAI_DAILY_ANALYSIS_MODEL` (configured deployment; current recommendation: `gpt-5.6-terra`)

Required for live Stage 2:

- `OPENAI_AGENT_MODEL` (current recommendation: `gpt-5.6-terra`)

Optional development configuration:

- `AI_DAILY_ANALYSIS_MODE=live|mock|disabled`
- `AI_DAILY_ANALYSIS_MOCK_RESULT=<strict JSON result>`
- `AI_DAILY_ANALYSIS_LOG_CONTEXT=true` to inspect the compact context locally only
- `AI_DAILY_ANALYSIS_ALLOW_DEBUG_RESET=true` to allow an authenticated mock-mode reset for the current date
- `AI_COACH_MODE=live|mock|disabled`
- `AI_COACH_MOCK_RESPONSES=<JSON array>` to replay read/write tool calls and final messages without paid requests
- `AI_COACH_LOG_TOOL_RESULTS=true` for local-only compact tool diagnostics

Model names are read once by Edge Function configuration code. Stage 1 persists the model identifier with its analysis result; Stage 2 keeps the configured model server-side and persists provider response IDs with user-visible assistant messages and tool audits.

The agent model choice follows the current official model capability page and requires Responses API function calling, multilingual output, and multi-step reasoning. The integration follows the official [Responses create reference](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create) and [GPT-5.6 Terra capability page](https://developers.openai.com/api/docs/models/gpt-5.6-terra). The business layer remains model-independent through environment configuration.

## Logging and privacy

Normal logs contain an analysis ID and a sanitized event/error class, not tokens, API keys, full prompts, or full user context. Compact context logging is opt-in for local development and must not be enabled in production. OpenAI requests use `store: false`.

## Testing strategy

- Unit tests: local date/time-zone boundaries, weight windows, strength progression, adherence, activity summaries, insufficiency, strict Stage 1 validation, strict Stage 2 tool schemas/classification, mocked multi-step Responses calls, confirmation tool lockout, and calorie adjustment math.
- pgTAP: Stage 1 uniqueness/claim lifecycle plus Stage 2 RLS isolation, message idempotency, service-only claims, today-only override semantics, active-session history protection, confirmation claiming, and idempotent persistent plan creation.
- Validation gate: strict TypeScript, Expo lint, unit tests, formatting, migration lint/pgTAP when local Supabase is available, Edge Function type check/serve where available, and Expo all-platform export.
- Manual states: Stage 1 disabled/no-action/suggestion/accept/dismiss; Stage 2 empty/history/loading/error/retry, read answer, multi-step today-only replacement, activity/weight write, persistent Apply/Cancel, Polish/English, kg/lb, and suggestion-to-Coach context.

Tests inject a mock Responses client and never use a paid OpenAI call.

## Stage 2 security and reliability assumptions

- The request body never contains a trusted user ID. The Edge Function derives identity from the verified bearer token, and every domain query runs through that user's RLS client.
- The model receives no token, email, service key, authentication metadata, arbitrary query interface, or SQL capability.
- Service-role access is limited to conversation processing/audit state. Service-only RPCs are revoked from authenticated clients.
- Tool arguments are treated as untrusted even after strict provider schema enforcement. Stable IDs are ownership-checked immediately before every operation.
- A conversation permits one fresh processing lease. Provider/tool failures store bounded codes and never break the core application.
- Retrying a request reuses its visible message. Audited completed writes are acknowledged instead of repeated; a stale in-progress write is replayed with the same audit ID. Daily operations are idempotent at their effect boundary, including a deterministic activity-log ID. Persistent writes are absolute operations; plan creation uses a deterministic resource ID.
- OpenAI requests use `store: false`; only in-memory encrypted reasoning continuity is requested during a single tool loop and discarded afterward.
