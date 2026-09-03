# Bulking Assistant

Bulking Assistant is an Expo/React Native workout, activity, body-weight, and nutrition assistant focused on fast, low-friction daily and in-gym logging.

All eight MVP phases and both AI Coach stages are implemented. The app includes the production foundation, authentication and onboarding, training planning, a complete active-workout flow, a persisted Today dashboard, the Body area for nutrition, weight trends and activity history, focused strength progress tracking, conservative automatic daily analysis, and a conversational Coach with controlled application tools.

## Current foundation

- Expo SDK 57, React Native 0.86, strict TypeScript, and Expo Router
- five-area native tab shell: Today, Training, Progress, Body, and Settings
- dark athletic design system with Google Sans Flex and `#CAFF00` brand accent
- English and Polish translations with device detection and persisted override
- Supabase client boundary with persisted-session configuration when environment values exist
- versioned PostgreSQL schema, bilingual catalog seed, and pgTAP user-isolation tests
- email/password authentication with protected routes and a transactional onboarding flow
- synchronized profile, language, and kg/lb preferences with kilograms kept canonical in storage
- virtualized bilingual exercise library with private custom exercise creation and deletion
- workout plan creation/editing with transactionally persisted exercise ordering
- weekly workout/activity/rest scheduling with planned duration and intensity, plus one-date overrides without changing the recurring week
- focused active workouts with elapsed time, exercise progress, previous-session reference, and independent weight/repetition sets
- resumable sessions, safe set editing/deletion/completion, localized session snapshots, and paginated workout history
- a live Today dashboard with local-date schedule resolution, daily overrides, workout shortcuts, completed activity, and current body weight
- deterministic plan-aware Mifflin–St Jeor calorie and macro targets persisted with a visible calculation breakdown
- authenticated once-per-local-day AI analysis built from deterministic weight, strength, adherence, activity, and nutrition summaries
- strict OpenAI Responses output validation, silent no-action behavior, explicit suggestion approval, bounded calorie adjustments, and mock/disabled modes
- durable AI Coach conversations with on-demand read tools, today-only workout/activity/weight actions, and confirmation cards for persistent plan or calorie changes
- date-specific exercise overrides that leave reusable plans unchanged and safely become the active-session snapshot when a workout starts
- native form sheets for quick activity logging and one-primary-entry-per-day weight logging
- a complete Body screen with live goal changes, current calories/macros, a seven-day weight average, weekly trend, and four-week rolling-average chart
- paginated non-strength activity history plus private custom activities shared with logging and scheduling
- exercise-specific eight-week progress with Estimated 1RM, Best Set, recent change, and accessible charts calculated from completed sets
- production polish for longer Polish copy, dynamic text sizing, keyboard-safe forms, accessible controls, and synchronized query refreshes
- automated English/Polish translation parity plus localized kg/lb presentation tests
- lightweight Expo Go-compatible charts rendered with `react-native-svg`
- TanStack Query provider and default caching policy
- responsive web fallback plus iOS and Android bundles
- Expo-aware linting and Prettier formatting

See [the product specification](docs/PRODUCT_SPEC.md), [AI Coach specification](docs/AI_COACH_SPEC.md), [nutrition calculation](docs/NUTRITION_CALCULATION.md), [quality audit](docs/QUALITY_AUDIT.md), and [implementation plan](docs/IMPLEMENTATION_PLAN.md) for scope, validation, and sequencing.

## Requirements

- Node.js 22.13+ (required by Expo SDK 57)
- npm
- Expo Go for the fastest native development loop

## Setup

Install dependencies:

```bash
npm install
```

Copy the environment template when connecting a Supabase project:

```bash
cp .env.example .env
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`. Use the client-safe publishable key (`sb_publishable_...`), as provided by Supabase. The app also accepts the canonical `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` name and the legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` name. These client keys are safe to bundle only with the included Row Level Security policies in place. Never place a secret key, service-role key, or another privileged credential in Expo public environment variables.

### Local Supabase

With Docker running, create and verify a clean local database:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint --local
npx supabase test db
```

Copy the local API URL and anon key printed by `supabase status` into `.env` using the same `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` variable names. Local development emails are available through Inbucket at `http://127.0.0.1:54324`.

### Hosted Supabase

Link a project, preview the migration set, and then apply the schema plus repeatable catalog seed:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push --include-seed
```

Before using the app against the hosted project, enable email/password sign-up in Supabase Auth and set the two public values in `.env`.

### AI Coach

The OpenAI key is a Supabase Edge Function secret, never an Expo variable. Configure live analysis and deploy the function after applying the migration:

```bash
npx supabase secrets set OPENAI_API_KEY=YOUR_KEY
npx supabase secrets set OPENAI_DAILY_ANALYSIS_MODEL=gpt-5.6-terra
npx supabase secrets set OPENAI_AGENT_MODEL=gpt-5.6-terra
npx supabase secrets set AI_DAILY_ANALYSIS_MODE=live
npx supabase secrets set AI_COACH_MODE=live
npx supabase functions deploy ensure-daily-analysis
npx supabase functions deploy ai-coach
```

For local, paid-call-free testing, create an ignored `supabase/functions/.env.local`. Stage 1 accepts `AI_DAILY_ANALYSIS_MODE=mock`, `AI_DAILY_ANALYSIS_MOCK_RESULT` as a strict result JSON string, and optionally `AI_DAILY_ANALYSIS_ALLOW_DEBUG_RESET=true`. Stage 2 accepts `AI_COACH_MODE=mock` and `AI_COACH_MOCK_RESPONSES` as a JSON array of mocked Responses API results, including function calls and final messages. Then run:

```bash
npx supabase functions serve ensure-daily-analysis --env-file supabase/functions/.env.local
npx supabase functions serve ai-coach --env-file supabase/functions/.env.local
```

Use `AI_DAILY_ANALYSIS_MODE=disabled` to record a silent no-action result without gathering context or calling OpenAI. Use `AI_COACH_MODE=disabled` to make Coach fail independently without affecting the rest of the app. Leave `AI_DAILY_ANALYSIS_LOG_CONTEXT` and `AI_COACH_LOG_TOOL_RESULTS` unset in production; both are opt-in local diagnostics that can expose compact fitness data in function logs.

Start the app:

```bash
npx expo start
```

Use Expo Go first. Press `i`, `a`, or `w` for the available iOS simulator, Android emulator, or web target.

## Validation scripts

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run format:check
npx supabase db lint --local
npx supabase test db
npx --yes deno check --config supabase/functions/ensure-daily-analysis/deno.json supabase/functions/ensure-daily-analysis/index.ts
npx --yes deno check --config supabase/functions/ai-coach/deno.json supabase/functions/ai-coach/index.ts
npx supabase functions serve ensure-daily-analysis --env-file supabase/functions/.env.local
npx supabase functions serve ai-coach --env-file supabase/functions/.env.local
npx expo export --platform all
```

Run `npm run format` to apply the repository formatting rules.

## Structure

```text
src/app/          route files only
src/screens/      feature screen composition
src/components/   reusable visual primitives
src/features/     domain logic, types, queries, and mutations
src/i18n/         English/Polish resources and locale persistence
src/lib/          shared environment and query setup
src/providers/    app-level providers
src/services/     Supabase and future external-service boundaries
src/theme/        the only source of visual tokens
supabase/         migrations, tests, seed data, and Edge Functions
docs/             product specification and implementation plan
```

## Versioned Expo documentation

This project is pinned to Expo SDK 57. Consult the [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) instead of the unversioned latest API pages when making version-specific changes.
