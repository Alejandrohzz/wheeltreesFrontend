import { useAppTheme } from '@/contexts/ThemeContext';
import { cancelarReserva, misReservas, Reserva } from '@/services/reservas';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const DARK_C = {
  bg:        '#131517',
  card:      '#1E2126',
  border:    '#2E343C',
  text:      '#FFFFFF',
  textMuted: '#6B7785',
  textSub:   '#9BA3AD',
  accent:    '#4A90D9',
  green:     '#3DBE7A',
  red:       '#E05C5C',
  yellow:    '#E0B84A',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  card: '#FFFFFF',
  border: '#DDE1E6',
  text: '#11181C',
  textMuted: '#7A8593',
  textSub: '#5B6472',
  accent: '#4A90D9',
  green: '#3DBE7A',
  red: '#E05C5C',
  yellow: '#E0B84A',
};

// Regla de negocio (UR010): cancelación permitida hasta 30 min antes de la
// salida. El backend actual NO valida esto todavía (solo revisa el estado),
// así que se aplica aquí como aviso/bloqueo preventivo del lado del cliente.
const MINUTOS_LIMITE_CANCELACION = 30;

const ESTILOS_ESTADO: Record<string, { color: string; label: string }> = {
  PENDIENTE:  { color: DARK_C.yellow, label: 'Pendiente' },
  CONFIRMADA: { color: DARK_C.green,  label: 'Confirmada' },
  RECHAZADA:  { color: DARK_C.red,    label: 'Rechazada' },
  CANCELADA:  { color: DARK_C.textMuted, label: 'Cancelada' },
  COMPLETADA: { color: DARK_C.accent, label: 'Completada' },
};

function minutosParaSalida(fechaHoraSalida: string) {
  return (new Date(fechaHoraSalida).getTime() - Date.now()) / 60000;
}

function puedeCancelarse(r: Reserva) {
  if (r.estado !== 'PENDIENTE' && r.estado !== 'CONFIRMADA') return false;
  return minutosParaSalida(r.fechaHoraSalida) >= MINUTOS_LIMITE_CANCELACION;
}

export default function MyReservationsScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const [reservas, setReservas]         = useState<Reserva[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState('');
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await misReservas();
      const orden = data.sort(
        (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()
      );
      setReservas(orden);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudieron cargar tus reservas');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const pedirCancelacion = (r: Reserva) => {
    Alert.alert(
      'Cancelar reserva',
      `¿Seguro que quieres cancelar tu reserva para el viaje desde ${r.origenViaje}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancelar(r) },
      ]
    );
  };

  const cancelar = async (r: Reserva) => {
    setCancelandoId(r.id);
    try {
      const actualizada = await cancelarReserva(r.id);
      setReservas((prev) => prev.map((x) => (x.id === r.id ? actualizada : x)));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo cancelar la reserva');
    } finally {
      setCancelandoId(null);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mis reservas</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.headerDivider} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {cargando && (
          <View style={s.centerBox}>
            <ActivityIndicator color={C.accent} />
          </View>
        )}

        {!cargando && !!error && (
          <View style={s.centerBox}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={cargar} style={s.retryBtn}>
              <Text style={s.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!cargando && !error && reservas.length === 0 && (
          <View style={s.centerBox}>
            <Text style={s.emptyText}>Todavía no tienes reservas</Text>
          </View>
        )}

        {!cargando && !error && reservas.map((r) => {
          const estilo = ESTILOS_ESTADO[r.estado] ?? { color: C.textMuted, label: r.estado };
          const cancelable = puedeCancelarse(r);
          const cancelando = cancelandoId === r.id;
          const faltan = minutosParaSalida(r.fechaHoraSalida);

          return (
            <View key={r.id} style={s.card}>
              <View style={s.topRow}>
                <View style={[s.badge, { backgroundColor: `${estilo.color}22` }]}>
                  <Text style={[s.badgeText, { color: estilo.color }]}>{estilo.label}</Text>
                </View>
              </View>

              <Text style={s.origen}>{r.origenViaje}</Text>
              <Text style={s.detail}>
                Sale: {new Date(r.fechaHoraSalida).toLocaleString('es-CO', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>

              {!!r.notasPasajero && (
                <Text style={s.notas}>Nota: {r.notasPasajero}</Text>
              )}

              {r.estado === 'CONFIRMADA' && (
                <TouchableOpacity
                  style={s.chatBtn}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: '/chat',
                      params: { otroUsuarioId: r.conductorId, otroUsuarioNombre: r.conductorNombre },
                    })
                  }
                >
                  <Text style={s.chatBtnText}>💬 Chatear con {r.conductorNombre}</Text>
                </TouchableOpacity>
              )}

              {r.estado === 'CONFIRMADA' && (
                <TouchableOpacity
                  style={s.trackBtn}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({ pathname: '/trip-tracking', params: { viajeId: r.viajeId } })
                  }
                >
                  <Text style={s.trackBtnText}>📍 Ver seguimiento en vivo</Text>
                </TouchableOpacity>
              )}

              {(r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA') && (
                <>
                  {cancelable ? (
                    <>
                      <Text style={s.avisoText}>
                        ⓘ Solo puedes cancelar hasta 30 min antes de la salida.
                      </Text>
                      <TouchableOpacity
                        style={[s.cancelBtn, cancelando && s.disabled]}
                        activeOpacity={0.7}
                        disabled={cancelando}
                        onPress={() => pedirCancelacion(r)}
                      >
                        {cancelando ? (
                          <ActivityIndicator color={C.red} size="small" />
                        ) : (
                          <Text style={s.cancelText}>Cancelar reserva</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={s.noCancelText}>
                      {faltan < 0
                        ? 'Este viaje ya salió, no se puede cancelar.'
                        : `Ya no se puede cancelar: faltan menos de ${MINUTOS_LIMITE_CANCELACION} min para la salida.`}
                    </Text>
                  )}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: C.text },
  headerTitle: { fontSize: 19, fontWeight: '700', color: C.text },
  headerDivider: { height: 1, backgroundColor: C.border },

  scroll: { padding: 20, gap: 16 },

  centerBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  errorText: { color: C.red, fontSize: 14, textAlign: 'center' },
  emptyText: { color: C.textSub, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: C.accent, fontWeight: '600' },

  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
  },
  topRow: { flexDirection: 'row', marginBottom: 10 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

  origen: { fontSize: 17, fontWeight: '700', color: C.text },
  detail: { fontSize: 13, color: C.textSub, marginTop: 4 },
  notas:  { fontSize: 13, color: C.textMuted, marginTop: 8, fontStyle: 'italic' },

  trackBtn: {
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
  },
  trackBtnText: { color: C.accent, fontWeight: '700', fontSize: 14 },

  chatBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
  },
  chatBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  cancelBtn: {
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
  avisoText: {
    fontSize: 12,
    color: C.textMuted,
    fontStyle: 'italic',
    marginTop: 14,
    marginBottom: 4,
  },
  disabled: { opacity: 0.6 },
  cancelText: { color: C.red, fontWeight: '700', fontSize: 14 },
  noCancelText: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 14,
    textAlign: 'center',
  },
});
}
