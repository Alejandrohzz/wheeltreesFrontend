import { useAppTheme } from '@/contexts/ThemeContext';
import { marcarAbordo, Reserva, reservasDeViaje } from '@/services/reservas';
import { Viaje } from '@/services/types';
import {
  conectarTracking,
  desconectarTracking,
  enviarUbicacion,
} from '@/services/tracking';
import { completarViaje, detalleViaje } from '@/services/viajes';
import { guardarInicioViaje, limpiarInicioViaje, obtenerInicioViaje } from '@/services/tripTimer';
import { codigoVerificacion } from '@/services/verificationCode';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  amber:     '#E0B84C',
  orange:    '#F5821F',
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
  amber: '#E0B84C',
  orange: '#F5821F',
};

export default function TripInProgressScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
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

  // ── Contador de minutos desde que el viaje inició ──
  // Se apoya en la hora real guardada al presionar "Iniciar viaje" (más
  // precisa) y si no existe (p. ej. se inició desde otro dispositivo o
  // sesión), usa el momento en que esta pantalla detecta el viaje EN_CURSO
  // como respaldo, para que el contador nunca se quede sin arrancar.
  const [transcurridoSeg, setTranscurridoSeg] = useState(0);
  const inicioRef = useRef<number | null>(null);

  useEffect(() => {
    if (viaje?.estado !== 'EN_CURSO' || !viajeId) {
      inicioRef.current = null;
      setTranscurridoSeg(0);
      return;
    }

    let activo = true;

    (async () => {
      let inicio = await obtenerInicioViaje(viajeId);
      if (!inicio) {
        inicio = Date.now();
        await guardarInicioViaje(viajeId, inicio);
      }
      if (!activo) return;
      inicioRef.current = inicio;
      setTranscurridoSeg(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));
    })();

    const tick = setInterval(() => {
      if (inicioRef.current) {
        setTranscurridoSeg(Math.max(0, Math.floor((Date.now() - inicioRef.current) / 1000)));
      }
    }, 1000);

    return () => {
      activo = false;
      clearInterval(tick);
    };
  }, [viaje?.estado, viajeId]);

  const tiempoFormateado = useMemo(() => {
    const h = Math.floor(transcurridoSeg / 3600);
    const m = Math.floor((transcurridoSeg % 3600) / 60);
    const sSeg = transcurridoSeg % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(sSeg).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }, [transcurridoSeg]);

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

          // Manda una posición inmediata apenas se conecta, sin esperar a
          // que el conductor se mueva. Sin esto, si el carro sigue
          // parqueado (p. ej. esperando al pasajero), watchPositionAsync
          // con distanceInterval no dispara NINGÚN evento hasta que se
          // recorran los 15m, y el pasajero se queda viendo "Esperando la
          // primera posición del conductor…" indefinidamente.
          try {
            const actual = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            if (activo) {
              enviarUbicacion(viajeId, actual.coords.latitude, actual.coords.longitude);
            }
          } catch {
            // Si falla el fix inicial, igual sigue el watcher de abajo.
          }

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

  // ── Resumen de pasajeros: cuántos abordaron, cuántos no se presentaron
  //    y cuántos siguen pendientes por confirmar ──
  const resumenPasajeros = useMemo(() => {
    const abordaron = reservas.filter((r) => r.abordo === true).length;
    const noPresentaron = reservas.filter((r) => r.abordo === false).length;
    const pendientes = reservas.filter((r) => r.abordo == null).length;
    return { total: reservas.length, abordaron, noPresentaron, pendientes };
  }, [reservas]);

  // Los pendientes de confirmar se muestran primero para que el conductor
  // los resuelva rápido; los ya gestionados quedan más abajo como registro.
  const reservasOrdenadas = useMemo(() => {
    const prioridad = (r: Reserva) => (r.abordo == null ? 0 : r.abordo ? 1 : 2);
    return [...reservas].sort((a, b) => prioridad(a) - prioridad(b));
  }, [reservas]);

  // ── Verificación de abordaje por código ──
  // Antes de marcar a alguien como "Abordó", el conductor debe ingresar el
  // código de 4 dígitos que el pasajero ve en "Mis reservas" y le dice al
  // subir. Evita marcar a la persona equivocada por un tap accidental.
  const [verificando, setVerificando] = useState<Reserva | null>(null);
  const [codigoIngresado, setCodigoIngresado] = useState('');
  const [codigoError, setCodigoError] = useState('');

  const abrirVerificacion = (reserva: Reserva) => {
    setVerificando(reserva);
    setCodigoIngresado('');
    setCodigoError('');
  };

  const cerrarVerificacion = () => {
    setVerificando(null);
    setCodigoIngresado('');
    setCodigoError('');
  };

  const confirmarCodigo = () => {
    if (!verificando) return;
    if (codigoIngresado === codigoVerificacion(verificando.id)) {
      const reserva = verificando;
      cerrarVerificacion();
      handleAbordo(reserva, true);
    } else {
      setCodigoError('El código no coincide. Pídeselo de nuevo al pasajero.');
    }
  };

  const marcarSinCodigo = () => {
    if (!verificando) return;
    Alert.alert(
      'Marcar sin verificar',
      `¿Confirmas que ${verificando.pasajeroNombre} abordó, sin haber verificado el código? Úsalo solo si el pasajero no puede mostrártelo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, marcar abordo',
          onPress: () => {
            const reserva = verificando;
            cerrarVerificacion();
            handleAbordo(reserva, true);
          },
        },
      ],
    );
  };

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
              await limpiarInicioViaje(viajeId);
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
        {viaje?.estado === 'EN_CURSO' && (
          <View style={s.timerPill}>
            <Text style={s.timerIcon}>⏱</Text>
            <Text style={s.timerText}>{tiempoFormateado}</Text>
          </View>
        )}
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
            <Text style={s.trackingError}>{errorUbicacion}</Text>
          ) : (
            <Text style={s.trackingText}>Conectando seguimiento en vivo…</Text>
          )}
        </View>
      )}

      {!cargando && !error && resumenPasajeros.total > 0 && (
        <View style={s.statsRow}>
          <View style={[s.statChip, { borderColor: C.amber }]}>
            <Text style={[s.statValue, { color: C.amber }]}>{resumenPasajeros.pendientes}</Text>
            <Text style={s.statLabel}>Pendientes</Text>
          </View>
          <View style={[s.statChip, { borderColor: C.green }]}>
            <Text style={[s.statValue, { color: C.green }]}>{resumenPasajeros.abordaron}</Text>
            <Text style={s.statLabel}>Abordaron</Text>
          </View>
          <View style={[s.statChip, { borderColor: C.red }]}>
            <Text style={[s.statValue, { color: C.red }]}>{resumenPasajeros.noPresentaron}</Text>
            <Text style={s.statLabel}>No llegaron</Text>
          </View>
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

        {!cargando && !error && reservasOrdenadas.map((r) => {
          const procesando = procesandoId === r.id;
          const estadoBadge =
            r.abordo === true
              ? { label: '✓ Abordó', color: C.green, bg: 'rgba(61,190,122,0.15)' }
              : r.abordo === false
              ? { label: '✕ No se presentó', color: C.red, bg: 'rgba(224,92,92,0.15)' }
              : { label: 'Pendiente', color: C.amber, bg: 'rgba(224,184,76,0.15)' };
          return (
            <View key={r.id} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.nombre}>{r.pasajeroNombre}</Text>
                <View style={[s.estadoBadge, { backgroundColor: estadoBadge.bg }]}>
                  <Text style={[s.estadoBadgeText, { color: estadoBadge.color }]}>
                    {estadoBadge.label}
                  </Text>
                </View>
              </View>
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
                    No se presentó
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
                  onPress={() => abrirVerificacion(r)}
                >
                  {procesando ? (
                    <ActivityIndicator color="#0A0A0A" size="small" />
                  ) : (
                    <Text style={[s.boardText, r.abordo === true && s.boardTextActive]}>
                      {r.abordo === true ? '✓ Abordó' : '🔑 Verificar y abordar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={s.contactLink}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/chat',
                    params: { otroUsuarioId: r.pasajeroId, otroUsuarioNombre: r.pasajeroNombre },
                  })
                }
              >
                <Text style={s.contactLinkText}>💬 Escribirle a {r.pasajeroNombre.split(' ')[0]}</Text>
              </TouchableOpacity>
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
              : <Text style={s.finText}>Finalizar viaje</Text>}
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={!!verificando}
        transparent
        animationType="fade"
        onRequestClose={cerrarVerificacion}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Verificar a {verificando?.pasajeroNombre}</Text>
            <Text style={s.modalSub}>
              Pídele el código de 4 dígitos que le aparece en "Mis reservas" y escríbelo aquí.
            </Text>

            <TextInput
              value={codigoIngresado}
              onChangeText={(t) => {
                setCodigoIngresado(t.replace(/[^0-9]/g, '').slice(0, 4));
                setCodigoError('');
              }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={C.textMuted}
              style={s.codigoInput}
              autoFocus
            />

            {!!codigoError && <Text style={s.modalError}>{codigoError}</Text>}

            <TouchableOpacity
              style={[s.modalConfirmBtn, codigoIngresado.length < 4 && s.disabled]}
              activeOpacity={0.85}
              disabled={codigoIngresado.length < 4}
              onPress={confirmarCodigo}
            >
              <Text style={s.modalConfirmText}>Confirmar código</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.modalGhostBtn} activeOpacity={0.7} onPress={marcarSinCodigo}>
              <Text style={s.modalGhostText}>No tiene el código, marcar igual</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.modalCancelBtn} activeOpacity={0.7} onPress={cerrarVerificacion}>
              <Text style={s.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
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

  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  timerIcon: { fontSize: 12 },
  timerText: { fontSize: 13, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },

  trackingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'rgba(61,190,122,0.10)',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  trackingText: { fontSize: 12, color: C.textSub, flex: 1 },
  trackingError: { fontSize: 12, color: C.amber, flex: 1 },

  statsRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14,
  },
  statChip: {
    flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 12,
    paddingVertical: 8, backgroundColor: C.card,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, color: C.textSub, marginTop: 2 },

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
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  nombre: { fontSize: 16, fontWeight: '700', color: C.text, flexShrink: 1 },
  notas:  { fontSize: 13, color: C.textSub, marginTop: 4 },

  estadoBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  estadoBadgeText: { fontSize: 11, fontWeight: '700' },

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

  contactLink: { alignSelf: 'center', marginTop: 10, paddingVertical: 4, paddingHorizontal: 8 },
  contactLinkText: { color: C.accent, fontWeight: '600', fontSize: 12 },

  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg,
  },
  finBtn: {
    backgroundColor: C.orange, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  finText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 360, backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, padding: 22, alignItems: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center' },
  modalSub: {
    fontSize: 13, color: C.textSub, textAlign: 'center', marginTop: 6, marginBottom: 18,
  },
  codigoInput: {
    width: 160, borderWidth: 1, borderColor: C.border, borderRadius: 14,
    paddingVertical: 12, textAlign: 'center', fontSize: 28, fontWeight: '800',
    letterSpacing: 10, color: C.text, backgroundColor: C.bg,
  },
  modalError: { color: C.red, fontSize: 12, marginTop: 10, textAlign: 'center' },
  modalConfirmBtn: {
    width: '100%', backgroundColor: C.green, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 18,
  },
  modalConfirmText: { color: '#0A0A0A', fontWeight: '700', fontSize: 15 },
  modalGhostBtn: { paddingVertical: 12 },
  modalGhostText: { color: C.textSub, fontSize: 12, textDecorationLine: 'underline' },
  modalCancelBtn: { paddingVertical: 4 },
  modalCancelText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
});
}
