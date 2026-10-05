import { calificar } from '@/services/calificaciones';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DARK_C = {
  overlay: 'rgba(0,0,0,0.6)',
  surface: '#1E2126',
  border: '#2E343C',
  text: '#FFFFFF',
  textMuted: '#6B7785',
  accent: '#4A90D9',
  star: '#F5B400',
};

const LIGHT_C = {
  overlay: 'rgba(0,0,0,0.4)',
  surface: '#FFFFFF',
  border: '#DDE1E6',
  text: '#11181C',
  textMuted: '#7A8593',
  accent: '#4A90D9',
  star: '#F5B400',
};

export type PersonaACalificar = {
  reservaId: string;
  nombre: string;
  rol?: 'CONDUCTOR' | 'PASAJERO';
};

export type CalificarModalProps = {
  visible: boolean;
  /**
   * Personas a calificar en este viaje. El pasajero ve al conductor (1 persona);
   * el conductor ve a todos los pasajeros que viajaron.
   */
  personas: PersonaACalificar[];
  /** Se llama cuando se terminó de calificar (o el usuario cerró el modal). */
  onDone: () => void;
};

type Valor = { puntuacion: number; comentario: string };

/**
 * Modal de calificación 1-5 estrellas + comentario opcional.
 * Muestra claramente a quién se califica; si son varias personas (conductor),
 * lista a todos los pasajeros del viaje, cada uno con su calificación.
 */
export function CalificarModal({ visible, personas, onDone }: CalificarModalProps) {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = getStyles(C);

  const [valores, setValores] = useState<Record<string, Valor>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Personas que aún faltan tras un envío parcial fallido (para reintentar solo esas).
  const [restantes, setRestantes] = useState<PersonaACalificar[] | null>(null);
  const lista = restantes ?? personas;

  const get = (id: string): Valor => valores[id] ?? { puntuacion: 0, comentario: '' };
  const set = (id: string, parcial: Partial<Valor>) =>
    setValores((prev) => ({ ...prev, [id]: { ...get(id), ...parcial } }));

  const reset = () => {
    setValores({});
    setError('');
    setRestantes(null);
  };

  const handleOmitir = () => {
    reset();
    onDone();
  };

  const multiple = personas.length > 1;

  const handleEnviar = async () => {
    const faltan = lista.filter((p) => get(p.reservaId).puntuacion === 0);
    if (faltan.length > 0) {
      setError(
        multiple
          ? `Falta calificar a: ${faltan.map((p) => p.nombre || 'Usuario').join(', ')}`
          : 'Selecciona una calificación'
      );
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const resultados = await Promise.allSettled(
        lista.map((p) => {
          const v = get(p.reservaId);
          return calificar({
            reservaId: p.reservaId,
            puntuacion: v.puntuacion,
            comentario: v.comentario.trim() || undefined,
          });
        })
      );
      const fallidas = lista.filter((_, i) => resultados[i].status === 'rejected');
      if (fallidas.length > 0) {
        // Conserva solo las que fallaron para poder reintentar.
        setValores((prev) => {
          const resto: Record<string, Valor> = {};
          fallidas.forEach((p) => { if (prev[p.reservaId]) resto[p.reservaId] = prev[p.reservaId]; });
          return resto;
        });
        const primera = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        setError(primera.reason?.message ?? 'No se pudo enviar la calificación');
        setRestantes(fallidas);
        return;
      }
      reset();
      onDone();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo enviar la calificación');
    } finally {
      setEnviando(false);
    }
  };

  const etiquetaRol = (rol?: 'CONDUCTOR' | 'PASAJERO') =>
    rol === 'CONDUCTOR' ? 'Conductor' : rol === 'PASAJERO' ? 'Pasajero' : null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>
            {multiple ? 'Califica a los pasajeros de tu viaje' : '¿Cómo estuvo tu viaje?'}
          </Text>

          <ScrollView style={s.lista} contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
            {lista.map((p) => {
              const v = get(p.reservaId);
              const rol = etiquetaRol(p.rol);
              return (
                <View key={p.reservaId} style={s.persona}>
                  <View style={s.personaHeader}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{(p.nombre?.trim()?.[0] ?? '?').toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.calificandoLabel}>Estás calificando a</Text>
                      <Text style={s.personaNombre} numberOfLines={1}>{p.nombre || 'Usuario'}</Text>
                      {!!rol && <Text style={s.personaRol}>{rol}</Text>}
                    </View>
                  </View>

                  <View style={s.starsRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity key={n} onPress={() => set(p.reservaId, { puntuacion: n })} hitSlop={8}>
                        <Text style={[s.star, n <= v.puntuacion && s.starActive]}>★</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={s.comentarioInput}
                    placeholder="Comentario (opcional)"
                    placeholderTextColor={C.textMuted}
                    value={v.comentario}
                    onChangeText={(t) => set(p.reservaId, { comentario: t })}
                    multiline
                    maxLength={300}
                  />
                </View>
              );
            })}
          </ScrollView>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity style={s.enviarBtn} onPress={handleEnviar} disabled={enviando} activeOpacity={0.85}>
            {enviando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.enviarBtnText}>{multiple ? 'Enviar calificaciones' : 'Enviar calificación'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleOmitir} disabled={enviando}>
            <Text style={s.omitirText}>Ahora no</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (C: typeof DARK_C) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    alignItems: 'center',
  },
  title: { color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  lista: { width: '100%', maxHeight: 420, marginBottom: 12 },
  persona: { width: '100%', borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, alignItems: 'center' },
  personaHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  calificandoLabel: { color: C.textMuted, fontSize: 11 },
  personaNombre: { color: C.text, fontSize: 15, fontWeight: '700' },
  personaRol: { color: C.accent, fontSize: 12, fontWeight: '600' },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  star: { fontSize: 34, color: C.border },
  starActive: { color: C.star },
  comentarioInput: {
    width: '100%',
    minHeight: 60,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
    color: C.text,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  errorText: { color: '#E05C5C', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  enviarBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  enviarBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  omitirText: { color: C.textMuted, fontSize: 13 },
});
