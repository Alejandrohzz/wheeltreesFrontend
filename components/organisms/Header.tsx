import { IconButton } from '@/components/atoms/IconButton';
import { useTokens } from '@/components/theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type HeaderAction = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
};

export type HeaderProps = {
  title: string;
  onBack?: () => void;
  actions?: HeaderAction[];
  /** Slot libre a la izquierda del título, p. ej. un Avatar (molecule/atom aparte). */
  leftSlot?: ReactNode;
};

/**
 * Organism: combina IconButton (atom) + Text + un slot libre para armar la
 * barra superior típica de las pantallas (con o sin botón de volver, con
 * hasta varias acciones a la derecha como chat/notificaciones/config).
 */
export function Header({ title, onBack, actions = [], leftSlot }: HeaderProps) {
  const C = useTokens();

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {onBack && <IconButton icon="arrow-back" onPress={onBack} />}
        {leftSlot}
        <Text style={[styles.title, { color: C.text }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.actions}>
        {actions.map((action, i) => (
          <IconButton
            key={i}
            icon={action.icon}
            onPress={action.onPress}
            accessibilityLabel={action.accessibilityLabel}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
