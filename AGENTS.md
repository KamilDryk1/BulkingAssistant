# Bulking Assistant engineering rules

## Expo SDK 57

- Read the exact versioned documentation at https://docs.expo.dev/versions/v57.0.0/ before writing Expo code. Do not use `latest` documentation for version-specific APIs.
- Keep the application compatible with Expo Go unless a product requirement truly needs a development build.
- Install Expo-compatible packages with `npx expo install`.
- Use Expo Router for navigation. Files under `src/app/` are routes only.

## Architecture

- Keep route files thin. Route files render feature screens from `src/screens/` and own only navigation concerns.
- Put reusable, feature-agnostic UI in `src/components/`.
- Put domain behavior in `src/features/<domain>/`; keep pure calculations independent from React.
- Put external clients and network-facing code in `src/services/`, shared integration setup in `src/lib/`, and shared app providers in `src/providers/`.
- Keep all repeated visual values in `src/theme/`. Do not hardcode colors, type sizes, spacing, radii, or shadows in screens.
- Use strict TypeScript, kebab-case file names, and `@/` path aliases.
- Prefer local component state and TanStack Query. Do not add a global state library without a demonstrated need.
- Do not modify node_modules packages.

## Product conventions

- Treat kilograms as the canonical stored weight unit; convert only at input and presentation boundaries.
- Keep nutrition, progress, weight-trend, and schedule resolution logic in unit-tested pure functions.
- Never ask the user for information the app already knows or can infer.
- Keep planned weekly schedules separate from date-specific overrides and completed activity/session records.
- Snapshot ordered exercises when a workout session begins so later plan edits cannot alter history.
- All user-facing copy must use i18next translation keys. English is the fallback; Polish is supported from the start.

## Supabase and security

- Schema changes belong in versioned files under `supabase/migrations/`; seed data belongs in `supabase/seed.sql`.
- Enable and explicitly policy every user-owned table with Row Level Security.
- Treat predefined exercises and activities as globally readable, immutable catalog data. Custom entries are private to their owner.
- Never put a service-role key, AI provider key, or other privileged credential in the client. Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` belong in the Expo public environment.

## Validation

- Before handing off a phase, run TypeScript, lint, relevant tests, and an Expo export/start smoke check.
- Verify loading, empty, error, and normal states for every major screen added in that phase.
- Preserve unrelated user changes and do not knowingly leave the repository broken between phases.
