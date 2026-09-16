import { Input, InputProps } from '@/components/atoms/Input';
import { useTokens } from '@/components/theme/tokens';
import { StyleSheet, Text, View } from 'react-native';

export type FormFieldProps = InputProps & {
  label: string;
  error?: string | null;
};

/**
 * Molecule: label + Input (atom) + texto de error opcional.
 *
 * Reemplaza el patrón "Field" que estaba duplicado/copiado dentro de cada
 * pantalla (vehicle-form.tsx, login.tsx, register.tsx, etc). Al vivir en su
 * propio archivo de módulo, nunca se recrea en cada render → no hay riesgo
 * de que un TextInput pierda el foco/cierre el teclado con cada letra.
 */
export function FormField({ label, error, ...inputProps }: FormFieldProps) {
  const C = useTokens();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: C.textMuted }]}>{label}</Text>
      <Input hasError={!!error} {...inputProps} />
      {!!error && <Text style={[styles.error, { color: C.error }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  error: { fontSize: 12, marginTop: 4 },
});
