# Bulking Assistant product specification

## Product intent

Bulking Assistant is a mobile workout, activity, body-weight, and nutrition assistant designed to remove friction during training. It should infer the day, schedule, previous performance, nutrition target, logged activities, and today's weight state whenever those facts are available. The experience should guide the user through the day instead of behaving like a spreadsheet.

The first release is optimized for a single person's daily use, while authentication, ownership, database keys, and Row Level Security must support multiple isolated users from the beginning.

## MVP experience

The authenticated app uses five bottom tabs:

1. **Today** — today's calorie and macro target, planned workout or activity, completed activities, and current weight.
2. **Training** — today's workout, plans, exercise library, weekly schedule, and history.
3. **Progress** — exercise selection with Estimated 1RM and Best Set views.
4. **Body** — goal, nutrition target, weight trend, weight logging, and activity logs. This is not a food diary.
5. **Settings** — profile inputs, units, language, nutrition preferences, and account controls.

An active workout is a focused stack flow outside the dashboard. It shows the current exercise, elapsed time, overall progress, previous-session reference, independently editable weight-and-rep sets, large completion controls, previous/next exercise navigation, and a finish action.

## Core domain rules

- A weekly plan describes what is normally scheduled; daily overrides change one date without modifying the weekly template.
- Starting a workout creates a dated session and snapshots the ordered plan exercises.
- Previous sets are visible reference data and never automatically prefill today's sets.
- Each strength set is an independent `weight + reps` record with a completion state.
- The default weight UX exposes one entry per day, but the schema supports multiple timestamped entries; the latest is primary.
- Kilograms are canonical in storage. The UI can display and accept kilograms or pounds.
- Nutrition targets are deterministic. A centralized Mifflin–St Jeor calculation combines activity outside workouts with the resolved weekly training plan's duration and intensity, then applies documented goal and macro defaults. AI is not on the MVP critical path.
- Estimated 1RM uses completed sets and the Epley formula: `weight × (1 + reps / 30)`.
- Best Set chooses the highest completed weight, breaking ties with higher repetitions.

## Data domains

The Supabase/PostgreSQL model will cover profiles, exercises, workout plans and ordered plan exercises, weekly schedule items, daily overrides, workout sessions and ordered session exercises, workout sets, activity definitions and logs, weight logs, and nutrition target snapshots where useful.

Global predefined exercises and activities are readable by authenticated users and immutable to normal users. Custom definitions and all personal records belong to one user. Explicit RLS policies enforce ownership; client-side filtering is never considered security.

## Localization and units

- English and Polish ship from the foundation phase.
- Device language is used on first launch, English is the fallback, and Settings can persist an explicit choice.
- Authenticated profiles will store the preferred locale and weight unit.
- Predefined catalog items have stable identifiers and English/Polish names. Custom names remain as entered.

## Authentication and ownership

- Email/password authentication is the MVP identity mechanism and sessions persist across app launches.
- A profile row is created automatically for each Auth user; protected routes keep incomplete profiles in onboarding.
- Onboarding saves the completed profile and initial weight in one database transaction.
- Every user-owned table is protected by explicit select, insert, update, and delete policies. Child records derive ownership through their parent plan, override, or session.
- Client-side filters improve query efficiency but are never relied on for data isolation.

## Visual and interaction direction

The supplied concept is the primary visual reference: nearly black backgrounds, dark elevated cards, subtle borders, off-white type, muted secondary text, a restrained `#CAFF00` lime accent, generous rhythm, prominent numeric values, simple charts, and minimal icons. The app should feel premium, athletic, quiet, and immediately understandable.

Controls must be comfortable one-handed, have clear pressed states and accessible labels, respect safe areas and scalable type, and avoid tiny targets, dense tables, decorative noise, excessive gradients, or neon effects. Quick secondary tasks use native sheets where appropriate; complex editing uses full screens.

## MVP exclusions

The MVP excludes meals and food tracking, barcode scanning, calorie-intake logging, social features, wearables and health-platform integrations, automatic/AI workout generation, AI coaching chat, supersets, RPE/RIR, advanced periodization, achievements, complicated analytics, and offline synchronization.

## Quality bar

Each major surface must handle loading, empty, error, and normal states. Histories should be paginated, query caches invalidated after mutations, and only necessary records fetched. Unit tests prioritize unit conversion, nutrition calculations, Estimated 1RM, rolling weight average/trend, and schedule override resolution.
