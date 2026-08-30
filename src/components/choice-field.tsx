import { Pressable, View } from 'react-native';

import { colors, layout, opacity, radius, spacing } from '@/theme';

import { AppText } from './app-text';

type ChoiceOption<Value extends string> = {
  detail?: string;
  label: string;
  value: Value;
};

type ChoiceFieldProps<Value extends string> = {
  columns?: 1 | 2 | 3;
  detail?: string;
  error?: string;
  label: string;
  onChange: (value: Value) => void;
  options: readonly ChoiceOption<Value>[];
  value: Value;
};

export function ChoiceField<Value extends string>({
  columns = 2,
  detail,
  error,
  label,
  onChange,
  options,
  value,
}: ChoiceFieldProps<Value>) {
  const selectedDetail = options.find((option) => option.value === value)?.detail;

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="bodyStrong">{label}</AppText>
      {detail ? (
        <AppText color="textMuted" variant="caption">
          {detail}
        </AppText>
      ) : null}
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
      >
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: selected ? colors.primary : colors.surfaceElevated,
                borderColor: selected ? colors.primary : colors.border,
                borderCurve: 'continuous',
                borderRadius: radius.md,
                borderWidth: layout.borderWidth,
                flexBasis: columns === 1 ? '100%' : columns === 3 ? '30%' : '47%',
                flexGrow: 1,
                justifyContent: 'center',
                minHeight: layout.minTouchTarget,
                opacity: pressed ? opacity.pressed : 1,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              })}
            >
              <AppText
                color={selected ? 'onPrimary' : 'textSecondary'}
                style={{ textAlign: 'center' }}
                variant="bodyStrong"
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {selectedDetail ? (
        <View
          style={{
            backgroundColor: colors.surfaceSelected,
            borderColor: colors.borderStrong,
            borderCurve: 'continuous',
            borderRadius: radius.md,
            borderWidth: layout.borderWidth,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}
        >
          <AppText accessibilityLiveRegion="polite" color="textSecondary" variant="caption">
            {selectedDetail}
          </AppText>
        </View>
      ) : null}
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger" variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
