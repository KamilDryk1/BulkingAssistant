import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { CompactAction } from '@/components/compact-action';
import { formatWorkoutWeight, parseWorkoutSetInput } from '@/features/workout/workout-domain';
import { colors, fontFamilies, layout, radius, spacing, typography } from '@/theme';
import type { WeightUnit, WorkoutSetRow } from '@/types/database';

import type { SaveWorkoutSetInput } from './workout-types';

type SetEntryCardProps = {
  deleting: boolean;
  number: number;
  onDelete: (setId: string | null) => void;
  onSave: (input: SaveWorkoutSetInput, onSuccess: () => void) => void;
  onSaved?: () => void;
  saving: boolean;
  sessionExerciseId: string;
  set: WorkoutSetRow | null;
  unit: WeightUnit;
};

export function SetEntryCard({
  deleting,
  number,
  onDelete,
  onSave,
  onSaved,
  saving,
  sessionExerciseId,
  set,
  unit,
}: SetEntryCardProps) {
  const { t } = useTranslation(['workout', 'common']);
  const [weightInput, setWeightInput] = useState(() =>
    set ? formatWorkoutWeight(set.weight_kg, unit) : '',
  );
  const [repsInput, setRepsInput] = useState(() => (set ? String(set.reps) : ''));
  const [dirty, setDirty] = useState(false);
  const [inputError, setInputError] = useState<'reps' | 'weight' | null>(null);
  const completed = Boolean(set?.completed_at);
  const unitLabel = t(unit === 'lb' ? 'units.pounds' : 'units.kilograms', { ns: 'common' });
  const actionTitle = completed
    ? dirty
      ? t('active.saveChanges', { ns: 'workout' })
      : t('active.markIncomplete', { ns: 'workout' })
    : t('active.completeSet', { ns: 'workout' });

  const submit = () => {
    if (completed && !dirty && set) {
      onSave(
        {
          completed: false,
          reps: set.reps,
          sessionExerciseId,
          weightKg: set.weight_kg,
          workoutSetId: set.id,
        },
        () => setDirty(false),
      );
      return;
    }

    const parsed = parseWorkoutSetInput(weightInput, repsInput, unit);
    if (parsed.error || !parsed.value) {
      setInputError(parsed.error);
      return;
    }

    setInputError(null);
    onSave(
      {
        completed: true,
        reps: parsed.value.reps,
        sessionExerciseId,
        weightKg: parsed.value.weightKg,
        workoutSetId: set?.id ?? null,
      },
      () => {
        setDirty(false);
        onSaved?.();
      },
    );
  };

  const confirmDelete = () => {
    if (!set) {
      onDelete(null);
      return;
    }

    Alert.alert(
      t('active.deleteSetTitle', { ns: 'workout' }),
      t('active.deleteSetDetail', { ns: 'workout' }),
      [
        { style: 'cancel', text: t('actions.cancel', { ns: 'workout' }) },
        {
          onPress: () => onDelete(set.id),
          style: 'destructive',
          text: t('actions.delete', { ns: 'workout' }),
        },
      ],
    );
  };

  const inputStyle = {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    borderCurve: 'continuous' as const,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    color: colors.textPrimary,
    fontFamily: fontFamilies.semibold,
    fontSize: typography.title.fontSize,
    minHeight: layout.buttonHeight,
    paddingHorizontal: spacing.lg,
    textAlign: 'center' as const,
  };

  return (
    <Card elevated={completed} style={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
        <AppText style={{ flex: 1 }} variant="title">
          {t('active.setNumber', { ns: 'workout', number })}
        </AppText>
        <AppText color={completed ? 'primary' : 'textMuted'} variant="label">
          {t(completed ? 'active.completed' : 'active.incomplete', { ns: 'workout' })}
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <AppText color="textSecondary" variant="caption">
            {t('active.weight', { ns: 'workout' })} ({unitLabel})
          </AppText>
          <TextInput
            accessibilityLabel={t('active.weight', { ns: 'workout' })}
            cursorColor={colors.primary}
            keyboardType="decimal-pad"
            onChangeText={(value) => {
              setWeightInput(value);
              setDirty(true);
              setInputError(null);
            }}
            selectTextOnFocus
            selectionColor={colors.primary}
            style={inputStyle}
            value={weightInput}
          />
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <AppText color="textSecondary" variant="caption">
            {t('active.reps', { ns: 'workout' })}
          </AppText>
          <TextInput
            accessibilityLabel={t('active.reps', { ns: 'workout' })}
            cursorColor={colors.primary}
            keyboardType="number-pad"
            onChangeText={(value) => {
              setRepsInput(value);
              setDirty(true);
              setInputError(null);
            }}
            selectTextOnFocus
            selectionColor={colors.primary}
            style={inputStyle}
            value={repsInput}
          />
        </View>
      </View>

      {inputError ? (
        <AppText color="danger" variant="caption">
          {t(inputError === 'weight' ? 'active.weightError' : 'active.repsError', {
            ns: 'workout',
          })}
        </AppText>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <AppButton
          loading={saving}
          onPress={submit}
          style={{ flex: 1 }}
          title={actionTitle}
          variant={completed && !dirty ? 'secondary' : 'primary'}
        />
        <CompactAction
          accessibilityLabel={t('active.deleteSet', { ns: 'workout' })}
          disabled={saving || deleting}
          label="×"
          onPress={confirmDelete}
        />
      </View>
    </Card>
  );
}
