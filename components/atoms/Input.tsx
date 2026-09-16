import { useTokens } from '@/components/theme/tokens';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';

export type InputProps = TextInputProps & {
  hasError?: boolean;
};

/**
 * Atom: campo de texto base. Sin label ni mensaje de error — esa
 * responsabilidad es del molecule FormField, que combina este átomo con
 * <Text>.
 *
 * IMPORTANTE: este componente se define UNA sola vez a nivel de módulo
 * (como todos los archivos en components/atoms), así que nunca sufre el bug
 * de "se recrea en cada render y pierde el foco" que tenía el Field
 * declarado dentro de vehicle-form.tsx.
 */
export function Input({ hasError = false, style, ...rest }: InputProps) {
  const C = useTokens();

  return (
    <TextInput
      style={[
        styles.base,
        {
          backgroundColor: C.surface,
          borderColor: hasError ? C.error : C.border,
          color: C.text,
        },
        style,
      ]}
      placeholderTextColor={C.textMuted}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});
