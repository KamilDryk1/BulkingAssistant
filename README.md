# Bulking Assistant

Bulking Assistant is an Expo/React Native workout, activity, body-weight, and nutrition assistant focused on fast, low-friction daily and in-gym logging.

Phase 1 is complete. The repository currently contains the production app foundation and intentionally shows localized empty states; authentication and persisted product data begin in Phase 2.

## Current foundation

- Expo SDK 57, React Native 0.86, strict TypeScript, and Expo Router
- five-area native tab shell: Today, Training, Progress, Body, and Settings
- dark athletic design system with Google Sans Flex and `#CAFF00` brand accent
- English and Polish translations with device detection and persisted override
- Supabase client boundary with persisted-session configuration when environment values exist
- TanStack Query provider and default caching policy
- responsive web fallback plus iOS and Android bundles
- Expo-aware linting and Prettier formatting

See [the product specification](docs/PRODUCT_SPEC.md) and [implementation plan](docs/IMPLEMENTATION_PLAN.md) for scope and sequencing.

## Requirements

- Node.js 22.13 or newer (the Expo SDK 57 minimum)
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

Set the project URL and publishable key. A legacy anon key is also supported. Public Supabase client keys are safe to bundle only when the database is protected with the Row Level Security policies planned for Phase 2; never place a service-role key in Expo public environment variables.

Start the app:

```bash
npx expo start
```

Use Expo Go first. Press `i`, `a`, or `w` for the available iOS simulator, Android emulator, or web target.

## Validation scripts

```bash
npm run typecheck
npm run lint
npm run format:check
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
supabase/         migrations, seed data, and future edge functions
docs/             product specification and implementation plan
```

## Versioned Expo documentation

This project is pinned to Expo SDK 57. Consult the [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) instead of the unversioned latest API pages when making version-specific changes.
