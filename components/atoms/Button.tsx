import { useTokens } from '@/components/theme/tokens';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

export type ButtonProps = Omit<TouchableOpacityProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
};

/**
 * Atom: botón base de la app. No sabe nada de formularios ni de pantallas
 * específicas — solo presenta un label, maneja loading/disabled y las
 * variantes visuales.
 */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const C = useTokens();
  const isDisabled = disabled || loading;

  const variantStyle = {
    primary:   { backgroundColor: C.accent, borderColor: C.accent },
    secondary: { backgroundColor: C.surfaceAlt, borderColor: C.border },
    outline:   { backgroundColor: 'transparent', borderColor: C.accent },
    danger:    { backgroundColor: C.error, borderColor: C.error },
  }[variant];

  const textColor = variant === 'outline' ? C.accent : C.accentText;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        variantStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.6 },
  label: { fontSize: 16, fontWeight: '700' },
});
