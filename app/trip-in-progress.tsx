import { marcarAbordo, Reserva, reservasDeViaje } from '@/services/reservas';
import { Viaje } from '@/services/types';
import {
  conectarTracking,
  desconectarTracking,
  enviarUbicacion,
} from '@/services/tracking';
import { completarViaje, detalleViaje } from '@/services/viajes';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const C = {
  bg:        '#131517',
  card:      '#1E2126',
  border:    '#2E343C',
  text:      '#FFFFFF',
  textMuted: '#6B7785',
  textSub:   '#9BA3AD',
  accent:    '#4A90D9',
  green:     '#3DBE7A',
  red:       '#E05C5C',
  amber:     '#E0B84C',
  orange:    '#F5821F',
};

export default function TripInProgressScreen() {
  const router = useRouter();
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>();

  const [viaje, setViaje]       = useState<Viaje | null>(null);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [finalizando, setFinalizando]   = useState(false);

  // ── Seguimiento en tiempo real: compartir mi posición GPS mientras
  //    el viaje esté EN_CURSO, para que los pasajeros vean el avance ──
  const [compartiendo, setCompartiendo] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState('');
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  const cargar = useCallback(async () => {
    if (!viajeId) return;
    setCargando(true);
    setError('');
    try {
      const [v, rs] = await Promise.all([detalleViaje(viajeId), reservasDeViaje(viajeId)]);
      setViaje(v);
      setReservas(rs.filter((r) => r.estado === 'CONFIRMADA'));
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cargar el viaje');
    } finally {
      setCargando(false);
    }
  }, [viajeId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // Empieza a compartir la ubicación en vivo apenas se confirma que el
  // viaje está EN_CURSO (el backend rechaza reportar ubicación en
  // cualquier otro estado). Se detiene al salir de la pantalla o si el
  // viaje deja de estar en curso.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (viaje?.estado !== 'EN_CURSO' || !viajeId) return;

    let activo = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorUbicacion('Activa el permiso de ubicación para compartirla con tus pasajeros');
        return;
      }

      await conectarTracking(
        async () => {
          if (!activo) return;
          setCompartiendo(true);
          setErrorUbicacion('');

          watcherRef.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 15 },
            (pos) => {
              enviarUbicacion(viajeId, pos.coords.latitude, pos.coords.longitude);
            },
          );
        },
        (err) => {
          if (!activo) return;
          setCompartiendo(false);
          setErrorUbicacion(err);
        },
      );
    })();

    return () => {
      activo = false;
      watcherRef.current?.remove();
      watcherRef.current = null;
      desconectarTracking();
      setCompartiendo(false);
    };
  }, [viaje?.estado, viajeId]);

  const handleAbordo = async (reserva: Reserva, abordo: boolean) => {
    setProcesandoId(reserva.id);
    try {
      const actualizada = await marcarAbordo(reserva.id, abordo);
      setReservas((prev) => prev.map((r) => (r.id === reserva.id ? actualizada : r)));
    } catch (e: any) {
      Alert.alert('No se pudo actualizar', e?.message ?? 'Inténtalo de nuevo');
    } finally {
      setProcesandoId(null);
    }
  };

  const handleFinalizar = () => {
    const sinDecidir = reservas.filter((r) => r.abordo == null).length;
    Alert.alert(
      'Finalizar viaje',
      sinDecidir > 0
        ? `Todavía tienes ${sinDecidir} pasajero(s) sin confirmar. Al finalizar, se marcarán como "no se presentó" automáticamente. ¿Continuar?`
        : '¿Confirmas que el viaje terminó?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            setFinalizando(true);
            try {
              await completarViaje(viajeId);
              Alert.alert('Viaje finalizado', 'El viaje quedó marcado como completado.', [
                { text: 'OK', onPress: () => router.replace('/my-trips') },
              ]);
            } catch (e: any) {
              Alert.alert('No se pudo finalizar', e?.message ?? 'Inténtalo de nuevo');
            } finally {
              setFinalizando(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>Viaje en curso</Text>
          {!!viaje && (
            <Text style={s.headerSub} numberOfLines={1}>
              {viaje.origenDescripcion} → {viaje.destinoDescripcion}
            </Text>
          )}
        </View>
      </View>
      <View style={s.headerDivider} />

      {viaje?.estado === 'EN_CURSO' && (
        <View style={s.trackingBanner}>
          {compartiendo ? (
            <>
              <View style={s.liveDot} />
              <Text style={s.trackingText}>Compartiendo tu ubicación en vivo con los pasajeros</Text>
            </>
          ) : errorUbicacion ? (
            <Text style={s.trackingError}>⚠️ {errorUbicacion}</Text>
          ) : (
            <Text style={s.trackingText}>Conectando seguimiento en vivo…</Text>
          )}
        </View>
      )}

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
            <Text style={s.emptyText}>Este viaje no tiene pasajeros confirmados.</Text>
          </View>
        )}

        {!cargando && !error && reservas.map((r) => {
          const procesando = procesandoId === r.id;
          return (
            <View key={r.id} style={s.card}>
              <Text style={s.nombre}>{r.pasajeroNombre}</Text>
              {!!r.notasPasajero && <Text style={s.notas}>{r.notasPasajero}</Text>}

              <View style={s.actionsRow}>
                <TouchableOpacity
                  style={[
                    s.actionBtn, s.noShowBtn,
                    r.abordo === false && s.noShowBtnActive,
                    procesando && s.disabled,
                  ]}
                  activeOpacity={0.7}
                  disabled={procesando}
                  onPress={() => handleAbordo(r, false)}
                >
                  <Text style={[s.noShowText, r.abordo === false && s.noShowTextActive]}>
                    ❌ No se presentó
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.actionBtn, s.boardBtn,
                    r.abordo === true && s.boardBtnActive,
                    procesando && s.disabled,
                  ]}
                  activeOpacity={0.7}
                  disabled={procesando}
                  onPress={() => handleAbordo(r, true)}
                >
                  {procesando ? (
                    <ActivityIndicator color="#0A0A0A" size="small" />
                  ) : (
                    <Text style={[s.boardText, r.abordo === true && s.boardTextActive]}>
                      ✅ Abordó
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {!cargando && !error && (
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.finBtn, finalizando && s.disabled]}
            activeOpacity={0.85}
            disabled={finalizando}
            onPress={handleFinalizar}
          >
            {finalizando
              ? <ActivityIndicator color="#0A0A0A" />
              : <Text style={s.finText}>🏁 Finalizar viaje</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: C.text },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  headerSub:   { fontSize: 12, color: C.textMuted, marginTop: 1 },
  headerDivider: { height: 1, backgroundColor: C.border },

  trackingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'rgba(61,190,122,0.10)',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  trackingText: { fontSize: 12, color: C.textSub, flex: 1 },
  trackingError: { fontSize: 12, color: C.amber, flex: 1 },

  scroll: { padding: 20, gap: 14, flexGrow: 1 },

  centerBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  errorText: { color: C.red, fontSize: 14, textAlign: 'center' },
  emptyText: { color: C.textSub, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1, borderColor: C.accent, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  retryText: { color: C.accent, fontWeight: '600' },

  card: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, padding: 16,
  },
  nombre: { fontSize: 16, fontWeight: '700', color: C.text },
  notas:  { fontSize: 13, color: C.textSub, marginTop: 4 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, borderRadius: 12, borderWidth: 1,
  },
  disabled: { opacity: 0.6 },

  noShowBtn:       { borderColor: C.border, backgroundColor: 'transparent' },
  noShowBtnActive: { borderColor: C.red, backgroundColor: 'rgba(224,92,92,0.15)' },
  noShowText:       { color: C.textSub, fontWeight: '600', fontSize: 13 },
  noShowTextActive: { color: C.red },

  boardBtn:       { borderColor: C.border, backgroundColor: 'transparent' },
  boardBtnActive: { borderColor: C.green, backgroundColor: C.green },
  boardText:       { color: C.textSub, fontWeight: '600', fontSize: 13 },
  boardTextActive: { color: '#0A0A0A' },

  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg,
  },
  finBtn: {
    backgroundColor: C.orange, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  finText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
