import { StyleSheet, Text, View } from 'react-native';

type BadgeContadorProps = {
  n: number;
  color?: string;
};

/** Globito con número sobre un ícono.
 * No se muestra cuando el contador es 0 o menor.
 * Verde por defecto, pero permite personalizar el color.
 */
export default function BadgeContador({
  n,
  color = '#3DBE7A',
}: BadgeContadorProps) {
  if (!n || n <= 0) return null;

  return (
    <View
      style={[s.badge, { backgroundColor: color }]}
      pointerEvents="none"
    >
      <Text style={s.text}>{n > 99 ? '99+' : String(n)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,

    // Color configurable mediante la prop "color"
    backgroundColor: '#3DBE7A',

    // Estilo de la primera versión
    borderWidth: 1.5,
    borderColor: '#131517',

    alignItems: 'center',
    justifyContent: 'center',
  },

  text: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});