import { useTokens } from '@/components/theme/tokens';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Molecule: tarjeta contenedora reutilizable (para listas de vehículos,
 * viajes, notificaciones, etc). Si recibe onPress, se vuelve presionable.
 */
export function Card({ children, onPress, style }: CardProps) {
  const C = useTokens();
  const cardStyle = [
    styles.base,
    { backgroundColor: C.surface, borderColor: C.border },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
});
