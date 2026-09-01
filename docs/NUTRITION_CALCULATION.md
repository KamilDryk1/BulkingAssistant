# Nutrition calculation v2

Bulking Assistant calculates nutrition targets deterministically in `src/features/today/nutrition-domain.ts`. The calculation is an estimate for generally healthy adults, not a medical or clinical prescription.

## Energy

Version: `mifflin-st-jeor-plan-aware-v2`.

Resting energy uses the Mifflin–St Jeor equation:

```text
male   = 10 × weightKg + 6.25 × heightCm − 5 × age + 5
female = 10 × weightKg + 6.25 × heightCm − 5 × age − 161
```

The equation comes from Mifflin et al., _A new predictive equation for resting energy expenditure in healthy individuals_ ([PubMed](https://pubmed.ncbi.nlm.nih.gov/2305711/)).

The selected activity level describes normal movement and physical work **outside scheduled workouts**. Estimated resting energy is multiplied by its factor:

| Activity outside workouts | Factor |
| ------------------------- | -----: |
| Sedentary                 |    1.2 |
| Light                     |  1.375 |
| Moderate                  |   1.55 |
| Very active               |  1.725 |
| Extremely active          |    1.9 |

The resolved Monday-to-Sunday plan is calculated separately. A date-specific override replaces the recurring items for that date. Every planned workout or activity has a duration and light, moderate, or hard intensity. Activities use MET estimates derived from the [2024 Adult Compendium of Physical Activities](https://pmc.ncbi.nlm.nih.gov/articles/PMC10818145/); strength workouts use 3.5, 5.0, and 6.0 MET respectively.

For each planned session:

```text
gross session kcal = MET × 3.5 × weightKg ÷ 200 × durationMinutes
resting kcal during session = restingCalories ÷ 1440 × durationMinutes
net session kcal = max(0, gross session kcal − resting kcal during session)
```

Subtracting resting energy for the same interval prevents counting it twice. The weekly net total is divided by seven to keep the daily target stable across the week:

```text
maintenance = restingCalories × outsideWorkoutActivityFactor
            + weeklyPlannedTrainingCalories ÷ 7
base target = maintenance + goalAdjustment
effective target = base target + approved persistent calorie adjustment
```

Completed workout and activity logs are not added again: the resolved plan is the single training-energy source for the target.

Goal adjustment:

| Goal     | Daily adjustment |
| -------- | ---------------: |
| Cut      |        −400 kcal |
| Maintain |           0 kcal |
| Gain     |        +250 kcal |

The base result is rounded to the nearest 10 kcal. The general MVP safeguard is 1,500 kcal for male profiles and 1,200 kcal for female profiles. A Stage 1 AI suggestion can propose a conservative adjustment in non-zero 50 kcal steps up to 300 kcal, but the persistent offset changes only after explicit user approval. The user can reset that offset to zero from Body. MET values and activity factors are population-level estimates, so the result should be treated as a starting point and refined from repeated trends rather than as a precise measurement.

## Macros

- Protein: 2.0 g/kg when cutting and 1.8 g/kg when maintaining or gaining. These values sit within the 1.4–2.0 g/kg range described by the International Society of Sports Nutrition for most exercising adults ([position stand](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/)).
- Fat: 25% of target calories, within the commonly cited 20–35% range for healthy adults ([Academy position](https://www.sciencedirect.com/science/article/pii/S2212267213016729)).
- Carbohydrate: the remaining calories after protein and fat, never below zero.

## Persistence and recalculation

The Today query uses the profile, latest canonical kilogram weight, and resolved schedule for the current calendar week. It compares the result with the snapshot for the local calendar date and upserts only when the calculation version or result differs. The snapshot keeps resting calories, the outside-workout baseline, average planned-training calories, goal adjustment, deterministic base target, approved persistent adjustment, effective target, and macros.

Profile, body-weight, plan, recurring-schedule, and date-specific override mutations invalidate Today data, so the current snapshot is recalculated without asking for information the app already knows.
