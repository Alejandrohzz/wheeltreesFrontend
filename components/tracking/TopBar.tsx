import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackColors } from './theme';

interface Props {
  C: TrackColors;
  titulo: string;
  onBack: () => void;
  derecha?: ReactNode;
  /** Se informa el alto total (incluye status bar) para el padding del mapa. */
  onAlto?: (alto: number) => void;
}

/** Barra superior con flecha y título; usa los colores del tema de la app. */
export default function TopBar({ C, titulo, onBack, derecha, onAlto }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        s.bar,
        { paddingTop: insets.top + 6, backgroundColor: C.bg, borderBottomColor: C.border },
      ]}
      onLayout={(e) => onAlto?.(e.nativeEvent.layout.height)}
    >
      <TouchableOpacity onPress={onBack} style={s.back} activeOpacity={0.7} hitSlop={10}>
        <Ionicons name="arrow-back" size={24} color={C.text} />
      </TouchableOpacity>
      <Text style={[s.titulo, { color: C.text }]} numberOfLines={1}>{titulo}</Text>
      <View style={s.derecha}>{derecha}</View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 40, height: 36, justifyContent: 'center' },
  titulo: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  derecha: { minWidth: 40, alignItems: 'flex-end' },
});
