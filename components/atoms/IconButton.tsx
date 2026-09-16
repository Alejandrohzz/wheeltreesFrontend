import { useTokens } from '@/components/theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, TouchableOpacityProps } from 'react-native';

export type IconButtonProps = Omit<TouchableOpacityProps, 'style'> & {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  variant?: 'filled' | 'ghost';
  color?: string;
};

/** Atom: botón circular con un solo ícono (back, settings, notificaciones, etc). */
export function IconButton({
  icon,
  size = 22,
  variant = 'ghost',
  color,
  onPress,
  ...rest
}: IconButtonProps) {
  const C = useTokens();
  const iconColor = color ?? C.text;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.base,
        variant === 'filled' && { backgroundColor: C.surfaceAlt, borderColor: C.border, borderWidth: 1 },
      ]}
      {...rest}
    >
      <Ionicons name={icon} size={size} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
