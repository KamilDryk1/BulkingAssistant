# Bulking Assistant implementation plan

## Proposed project architecture

```text
src/
├── app/                    # Expo Router route files only
│   ├── (auth)/             # Phase 2 sign-in and sign-up stack
│   ├── (tabs)/             # Today, Training, Progress, Body, Settings
│   ├── onboarding/         # Phase 2 profile setup flow
│   ├── training-tools/     # Phase 3 catalog, plans, schedule, and overrides
│   └── workout/            # Phase 4 focused active-workout stack
├── components/             # Reusable visual primitives
├── screens/                # Screen composition, grouped by feature
├── features/               # Domain types, pure logic, query hooks, mutations
├── hooks/                  # Cross-feature React hooks
├── i18n/                   # Setup plus English and Polish resources
├── lib/                    # Environment and shared integration setup
├── providers/              # App-level providers
├── services/               # Supabase client and external service boundaries
├── theme/                  # Single source of visual tokens
├── types/                  # Cross-domain and generated database types
└── utils/                  # Small framework-independent helpers

supabase/
├── migrations/             # Versioned PostgreSQL schema and RLS
├── functions/              # Future privileged/AI server boundaries
└── seed.sql                # Repeatable predefined catalog data
```

## Foundation dependencies

- `@supabase/supabase-js` — typed Supabase client and persisted Auth foundation.
- `@tanstack/react-query` — server-state cache, mutation lifecycle, and invalidation.
- `expo-localization` — device locale detection using the SDK 57 API.
- `i18next` and `react-i18next` — organized English/Polish translations and React bindings.
- `@react-native-async-storage/async-storage` — persisted locale preference and Supabase session storage.
- `react-native-url-polyfill` — URL APIs expected by Supabase in React Native.
- `react-hook-form`, `zod`, and `@hookform/resolvers` — typed auth, onboarding, and profile forms.
- `react-native-svg` — Expo Go-compatible rendering for the lightweight Body and Progress charts.
- Google Sans Flex font assets/package — bundled typography matching the visual specification, with a system-sans fallback if the font cannot load.
- `eslint` and `eslint-config-expo` — Expo-aware static analysis for the phase validation gate.

No global state library is planned; authentication state is scoped to a provider and remote profile state remains in TanStack Query.

## Phase checklist

### Phase 1 — Foundation

- [x] Inspect the existing Expo project and SDK.
- [x] Document product requirements and engineering conventions.
- [x] Add the production folder structure and remove starter-demo routes/components.
- [x] Add design tokens, reusable primitives, Google Sans Flex, and dark app chrome.
- [x] Add English/Polish i18n with device detection and persisted selection.
- [x] Add five-tab Expo Router shell and representative empty states.
- [x] Add environment validation, Supabase client boundary, and TanStack Query provider.
- [x] Configure linting and validate typecheck, lint, and app export/start.

### Phase 2 — Supabase and authentication

- [x] Add versioned schema for profiles, catalogs, planning, sessions, activities, weight, and nutrition snapshots.
- [x] Enable RLS on all 14 exposed application tables and explicitly policy every operation.
- [x] Make global exercise/activity catalog rows authenticated-readable and immutable while keeping custom rows private.
- [x] Add a repeatable bilingual seed with stable identifiers for 56 exercises and 14 activities.
- [x] Add a signup trigger, transactional onboarding RPC, typed Supabase client, and pgTAP user-isolation suite.
- [x] Add email/password sign-in and sign-up, persisted sessions, protected Expo Router groups, and error/loading states.
- [x] Add onboarding and profile editing for date of birth, sex, height, activity level, goal, locale, and weight unit.
- [x] Synchronize language and unit preferences while storing body weight canonically in kilograms.
- [x] Add unit tests for kg/lb conversion and decimal input normalization.
- [x] Apply the schema to the linked project and run the linked schema linter.
- [ ] Execute a clean local database reset and pgTAP suite; the current host has no running PostgreSQL/Docker service.

### Phase 3 — Training domain

- [x] Add a bilingual, searchable, virtualized exercise catalog grouped by muscle with private custom exercise creation and safe deletion.
- [x] Add workout plan creation, editing, deletion, exercise selection, and transactionally persisted ordering.
- [x] Add the seven-day schedule with ordered workout/activity/rest items and transactional per-day replacement.
- [x] Add date-specific schedule overrides with weekly fallback and one-action reset to the recurring plan.
- [x] Resolve today's schedule in the Training tab and connect all Phase 3 navigation routes.
- [x] Add English/Polish copy, pure domain tests, linked migration deployment/lint, and iOS/Android/web export validation.

### Phase 4 — Active workout

- [x] Add an atomic session-start RPC with one active workout per user and localized ordered exercise snapshots.
- [x] Resolve and display the latest previous completed performance for each exercise without prefilling today's sets.
- [x] Add fast independent weight/repetition set entry with completion, editing, deletion, and gap-free numbering.
- [x] Add elapsed time, overall exercise progress, previous/next navigation, resume handling, and a focused stack flow.
- [x] Finish sessions into history and add paginated history plus snapshot-based workout details.
- [x] Add English/Polish copy, kg/lb boundary conversion, pure domain tests, linked migration deployment/lint, and iOS/Android/web export validation.

### Phase 5 — Today

- [x] Replace all Today placeholders with persisted nutrition, schedule, workout, activity, and weight data.
- [x] Resolve the local calendar date, recurring schedule, and date-specific override without asking for known information.
- [x] Add deterministic Mifflin–St Jeor calories and macros with centralized constants, tests, documentation, and daily snapshots.
- [x] Add start/resume/completed workout states, previous-workout context, and shortcuts to overrides, history, Training, and Body.
- [x] Add native quick-entry sheets for predefined activities and today's primary weight, including edit/delete and kg/lb conversion.
- [x] Show completed strength/activity records, the latest weight, and a seven-day average from the latest entry per calendar day.
- [x] Add English/Polish copy, loading/empty/error/normal states, RLS coverage, and all-platform export validation.

### Phase 6 — Body

- [x] Connect Body to the persisted daily nutrition target and expose immediate Cut/Maintain/Gain changes.
- [x] Reuse today's primary weight log/edit sheet while retaining canonical kilograms and preferred-unit display.
- [x] Calculate the latest-per-day seven-day average, previous-week comparison, and 28-day rolling-average chart in tested pure functions.
- [x] Add recent activity logs, paginated non-strength activity history, deletion, and quick-entry navigation.
- [x] Add private custom activity creation so new entries become available in activity logging and weekly schedules.
- [x] Cover English/Polish copy, loading/empty/error/normal states, and Phase 6 RLS behavior.

### Phase 7 — Progress

- [x] Add an exercise selector populated from completed workouts in the rolling eight-week window.
- [x] Add exactly two focused modes: Estimated 1RM and Best Set.
- [x] Calculate Estimated 1RM locally with Epley from completed sets and select one strongest result per session.
- [x] Select one representative Best Set per session by highest weight, then higher repetitions.
- [x] Add current results, recent change, accessible line charts, kg/lb presentation, and English/Polish copy.
- [x] Cover loading, empty, error, and normal states plus pure unit tests and all-platform export validation.

### Phase 8 — Polish

- [ ] Audit visual consistency, state coverage, accessibility, Polish expansion, conversions, platform behavior, performance, tests, and README.
