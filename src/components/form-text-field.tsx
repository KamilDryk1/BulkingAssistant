import { useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { colors, fontFamilies, layout, radius, spacing, typography } from '@/theme';

import { AppText } from './app-text';

type FormTextFieldProps = TextInputProps & {
  error?: string;
  label: string;
};

export function FormTextField({
  error,
  label,
  onBlur,
  onFocus,
  style,
  ...props
}: FormTextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="bodyStrong">{label}</AppText>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        cursorColor={colors.primary}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
            borderCurve: 'continuous',
            borderRadius: radius.md,
            borderWidth: layout.borderWidth,
            color: colors.textPrimary,
            fontFamily: fontFamilies.regular,
            fontSize: typography.body.fontSize,
            minHeight: layout.buttonHeight,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
          style,
        ]}
      />
      {error ? (
        <AppText color="danger" variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
