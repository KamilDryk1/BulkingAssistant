# Bulking Assistant implementation plan

## Proposed project architecture

```text
src/
├── app/                    # Expo Router route files only
│   ├── (auth)/             # Phase 2 sign-in and sign-up stack
│   ├── (tabs)/             # Today, Training, Progress, Body, Settings
│   ├── onboarding/         # Phase 2 profile setup flow
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
- `@react-native-async-storage/async-storage` — persisted locale preference now and Supabase session storage in Phase 2.
- `react-native-url-polyfill` — URL APIs expected by Supabase in React Native.
- Google Sans Flex font assets/package — bundled typography matching the visual specification, with a system-sans fallback if the font cannot load.
- `eslint` and `eslint-config-expo` — Expo-aware static analysis for the phase validation gate.

React Hook Form and Zod are intentionally deferred to Phase 2, when onboarding/auth forms create a real use case. No global state library is planned.

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

- [ ] Add versioned schema, RLS, seed strategy, email/password auth, persisted sessions, and onboarding/profile preferences.

### Phase 3 — Training domain

- [ ] Add exercise catalog/custom exercises, plan CRUD/reordering, weekly scheduling, and daily workout overrides.

### Phase 4 — Active workout

- [ ] Add session snapshots, previous-performance reference, fast set logging, exercise navigation, finishing, and history.

### Phase 5 — Today

- [ ] Connect the primary dashboard to persisted schedule, nutrition, activity, workout, and weight data.

### Phase 6 — Body

- [ ] Add deterministic nutrition calculations, weight entry/editing, rolling averages/trend, charting, and activity logs.

### Phase 7 — Progress

- [ ] Add exercise selection, Estimated 1RM, Best Set, charting, and recent trends.

### Phase 8 — Polish

- [ ] Audit visual consistency, state coverage, accessibility, Polish expansion, conversions, platform behavior, performance, tests, and README.
