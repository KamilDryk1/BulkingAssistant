import { Pressable, View } from 'react-native';

import { colors, layout, opacity, radius, spacing } from '@/theme';

import { AppText } from './app-text';

type ChoiceOption<Value extends string> = {
  label: string;
  value: Value;
};

type ChoiceFieldProps<Value extends string> = {
  columns?: 1 | 2;
  error?: string;
  label: string;
  onChange: (value: Value) => void;
  options: readonly ChoiceOption<Value>[];
  value: Value;
};

export function ChoiceField<Value extends string>({
  columns = 2,
  error,
  label,
  onChange,
  options,
  value,
}: ChoiceFieldProps<Value>) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="bodyStrong">{label}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
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
                flexBasis: columns === 1 ? '100%' : '47%',
                flexGrow: 1,
                justifyContent: 'center',
                minHeight: layout.minTouchTarget,
                opacity: pressed ? opacity.pressed : 1,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              })}
            >
              <AppText color={selected ? 'onPrimary' : 'textSecondary'} variant="bodyStrong">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText color="danger" variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
