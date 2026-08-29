# Nutrition calculation v1

Bulking Assistant calculates nutrition targets deterministically in `src/features/today/nutrition-domain.ts`. The calculation is an estimate for generally healthy adults, not a medical or clinical prescription.

## Energy

Version: `mifflin-st-jeor-v1`.

Resting energy uses the Mifflin–St Jeor equation:

```text
male   = 10 × weightKg + 6.25 × heightCm − 5 × age + 5
female = 10 × weightKg + 6.25 × heightCm − 5 × age − 161
```

The equation comes from Mifflin et al., _A new predictive equation for resting energy expenditure in healthy individuals_ ([PubMed](https://pubmed.ncbi.nlm.nih.gov/2305711/)).

Estimated resting energy is multiplied by the configured activity factor:

| Activity level   | Factor |
| ---------------- | -----: |
| Sedentary        |    1.2 |
| Light            |  1.375 |
| Moderate         |   1.55 |
| Very active      |  1.725 |
| Extremely active |    1.9 |

Goal adjustment:

| Goal     | Daily adjustment |
| -------- | ---------------: |
| Cut      |        −400 kcal |
| Maintain |           0 kcal |
| Gain     |        +250 kcal |

The result is rounded to the nearest 10 kcal. The general MVP safeguard is 1,500 kcal for male profiles and 1,200 kcal for female profiles. These constants are centralized and can be versioned later without changing UI code.

## Macros

- Protein: 2.0 g/kg when cutting and 1.8 g/kg when maintaining or gaining. These values sit within the 1.4–2.0 g/kg range described by the International Society of Sports Nutrition for most exercising adults ([position stand](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/)).
- Fat: 25% of target calories, within the commonly cited 20–35% range for healthy adults ([Academy position](https://www.sciencedirect.com/science/article/pii/S2212267213016729)).
- Carbohydrate: the remaining calories after protein and fat, never below zero.

## Persistence and recalculation

The Today query uses the profile values and the latest canonical kilogram weight. It compares the calculated result with the snapshot for the local calendar date and upserts only when the snapshot is missing or differs. Profile edits and body-weight mutations invalidate the Today cache, so the current day's snapshot is recalculated without asking the user to re-enter known information.
