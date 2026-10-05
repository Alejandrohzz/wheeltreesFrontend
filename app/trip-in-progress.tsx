import LiveMap from '@/components/tracking/LiveMap';
import TopBar from '@/components/tracking/TopBar';
import TrackingSheet from '@/components/tracking/TrackingSheet';
import { useCamara, useRumbo } from '@/components/tracking/hooks';
import { TRACK_DARK, TRACK_LIGHT } from '@/components/tracking/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useUbicacionViaje } from '@/hooks/useUbicacionViaje';
import { getRoute, LatLng, RouteInfo } from '@/services/directions';
import { dividirRuta, formatearDistancia, formatearEta, horaLlegada } from '@/services/geo';
import { marcarAbordo, Reserva, reservasDeViaje } from '@/services/reservas';
import { guardarInicioViaje, limpiarInicioViaje, obtenerInicioViaje } from '@/services/tripTimer';
import { Viaje } from '@/services/types';
import { codigoVerificacion } from '@/services/verificationCode';
import { completarViaje, detalleViaje } from '@/services/viajes';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Quita emojis que puedan venir dentro de los textos de traducción
// (los iconos de esta pantalla son Ionicons, así no se duplican).
const sinEmoji = (txt: string) =>
  txt.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();

export default function TripInProgressScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? TRACK_DARK : TRACK_LIGHT;
  const s = useMemo(() => estilos(C), [C]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>();
  const mapRef = useRef<any>(null);

  const [viaje, setViaje]       = useState<Viaje | null>(null);
  const [ruta, setRuta]         = useState<RouteInfo | null>(null);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [finalizando, setFinalizando]   = useState(false);
  const [altoTop, setAltoTop]     = useState(insets.top + 56);
  const [altoSheet, setAltoSheet] = useState(260);

  // ── Seguimiento en tiempo real: compartir mi posición GPS mientras
  //    el viaje esté EN_CURSO, para que los pasajeros vean el avance ──
  const {
    pasajeros: posPasajeros,
    miPosicion,
    compartiendo,
    permisoDenegado,
  } = useUbicacionViaje({
    viajeId,
    rol: 'CONDUCTOR',
    estadoInicial: viaje?.estado,
  });
  const errorUbicacion = permisoDenegado ? t('tripInProgress.errorPermisoUbicacion') : '';

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

      if (v.origenLat != null && v.origenLng != null && v.destinoLat != null && v.destinoLng != null) {
        try {
          setRuta(await getRoute(
            { lat: v.origenLat, lng: v.origenLng },
            { lat: v.destinoLat, lng: v.destinoLng },
          ));
        } catch { /* sin ruta trazada no es crítico */ }
      }
    } catch (e: any) {
      setError(e?.message ?? t('tripInProgress.errorLoad'));
    } finally {
      setCargando(false);
    }
  }, [viajeId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // ── Mapa: ruta, ETA y cámara ──
  const enCurso = viaje?.estado === 'EN_CURSO';
  const origen: LatLng | null = viaje?.origenLat != null && viaje?.origenLng != null
    ? { latitude: viaje.origenLat, longitude: viaje.origenLng } : null;
  const destino: LatLng | null = viaje?.destinoLat != null && viaje?.destinoLng != null
    ? { latitude: viaje.destinoLat, longitude: viaje.destinoLng } : null;
  const posAuto: LatLng | null = miPosicion
    ? { latitude: miPosicion.lat, longitude: miPosicion.lng } : null;
  const heading = useRumbo(posAuto);

  const dividida = useMemo(
    () => dividirRuta(ruta?.coordinates ?? [], enCurso ? posAuto : null),
    [ruta, enCurso, posAuto?.latitude, posAuto?.longitude],
  );
  const segPorMetro = ruta && ruta.distanceMeters > 0 ? ruta.durationSeconds / ruta.distanceMeters : 0.12;
  const segDestino = ruta
    ? (enCurso && posAuto ? dividida.metrosRestantes * segPorMetro : ruta.durationSeconds)
    : null;
  const etaDestino = segDestino != null ? formatearEta(segDestino) : null;

  const puntosCamara = useMemo(() => {
    const pts: LatLng[] = [];
    if (posAuto) pts.push(posAuto);
    if (destino) pts.push(destino);
    if (!posAuto && origen) pts.push(origen);
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posAuto?.latitude, posAuto?.longitude, destino?.latitude, origen?.latitude]);

  // Con el viaje en curso la cámara sigue MI ubicación actual (la del vehículo).
  const camara = useCamara(
    mapRef, puntosCamara, { top: altoTop, bottom: altoSheet }, !cargando && !error,
    enCurso ? posAuto : null,
  );

  const pasajerosMapa = useMemo(
    () => Object.values(posPasajeros).map((p, i) => ({
      id: p.usuarioId ?? String(i),
      latitude: p.lat,
      longitude: p.lng,
      nombre: p.nombre,
    })),
    [posPasajeros],
  );

  const navegar = () => {
    if (!destino) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${destino.latitude},${destino.longitude}&dirflg=d`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destino.latitude},${destino.longitude}&travelmode=driving`,
    })!;
    Linking.openURL(url).catch(() => {});
  };

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
      setCodigoError(t('tripInProgress.codigoNoCoincide'));
    }
  };

  const marcarSinCodigo = () => {
    if (!verificando) return;
    Alert.alert(
      t('tripInProgress.marcarSinVerificarTitle'),
      t('tripInProgress.marcarSinVerificarMsg', { nombre: verificando.pasajeroNombre }),
      [
        { text: t('tripInProgress.cancelar'), style: 'cancel' },
        {
          text: t('tripInProgress.siMarcarAbordo'),
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
      Alert.alert(t('tripInProgress.errorActualizarTitle'), e?.message ?? t('tripInProgress.intentaDeNuevo'));
    } finally {
      setProcesandoId(null);
    }
  };

  const handleFinalizar = () => {
    const sinDecidir = reservas.filter((r) => r.abordo == null).length;
    Alert.alert(
      t('tripInProgress.finalizarViaje'),
      sinDecidir > 0
        ? t('tripInProgress.pasajerosSinConfirmar', { n: sinDecidir })
        : t('tripInProgress.confirmasViajeTermino'),
      [
        { text: t('tripInProgress.cancelar'), style: 'cancel' },
        {
          text: t('tripInProgress.finalizar'),
          onPress: async () => {
            setFinalizando(true);
            try {
              await completarViaje(viajeId);
              await limpiarInicioViaje(viajeId);
              Alert.alert(t('tripInProgress.viajeFinalizadoTitle'), t('tripInProgress.viajeFinalizadoMsg'), [
                { text: t('tripInProgress.ok'), onPress: () => router.replace('/home') },
              ]);
            } catch (e: any) {
              Alert.alert(t('tripInProgress.errorNoSePudoFinalizar'), e?.message ?? t('tripInProgress.intentaDeNuevo'));
            } finally {
              setFinalizando(false);
            }
          },
        },
      ],
    );
  };

  // ── Encabezado del sheet (siempre visible) ──
  const header = (
    <View style={s.header}>
      <View style={s.tituloFila}>
        <View style={{ flex: 1 }}>
          <Text style={s.titular} numberOfLines={1}>
            {enCurso && etaDestino
              ? t('tripInProgress.llegadaEn', { eta: etaDestino })
              : t('tripInProgress.hacia', { destino: viaje?.destinoDescripcion ?? '' })}
          </Text>
          <Text style={s.subtitular} numberOfLines={1}>
            {enCurso && segDestino != null
              ? `${t('tripInProgress.llegadaEstimada', { hora: horaLlegada(segDestino) })} · ${formatearDistancia(dividida.metrosRestantes)}`
              : viaje?.destinoDescripcion ?? ''}
          </Text>
        </View>
        {!!destino && (
          <TouchableOpacity style={s.navegarBtn} onPress={navegar} activeOpacity={0.8}>
            <Ionicons name="navigate" size={16} color="#FFFFFF" />
            <Text style={s.navegarTxt}>{t('tripInProgress.navegar')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!cargando && !error && resumenPasajeros.total > 0 && (
        <View style={s.statsRow}>
          <View style={s.statChip}>
            <Text style={[s.statValue, { color: C.amber }]}>{resumenPasajeros.pendientes}</Text>
            <Text style={s.statLabel}>{t('tripInProgress.pendientes')}</Text>
          </View>
          <View style={s.statChip}>
            <Text style={[s.statValue, { color: C.green }]}>{resumenPasajeros.abordaron}</Text>
            <Text style={s.statLabel}>{t('tripInProgress.abordaron')}</Text>
          </View>
          <View style={s.statChip}>
            <Text style={[s.statValue, { color: C.red }]}>{resumenPasajeros.noPresentaron}</Text>
            <Text style={s.statLabel}>{t('tripInProgress.noLlegaron')}</Text>
          </View>
        </View>
      )}

      {!cargando && !error && (
        <TouchableOpacity
          style={[s.finBtn, finalizando && s.disabled]}
          activeOpacity={0.85}
          disabled={finalizando}
          onPress={handleFinalizar}
        >
          {finalizando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="flag" size={18} color="#FFFFFF" />
              <Text style={s.finText}>{t('tripInProgress.finalizarViaje')}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={s.root}>
      <TopBar
        C={C}
        titulo={t('tripInProgress.title')}
        onBack={() => router.back()}
        onAlto={setAltoTop}
        derecha={
          enCurso ? (
            <View style={s.timerPill}>
              <Ionicons name="timer-outline" size={14} color={C.accent} />
              <Text style={s.timerText}>{tiempoFormateado}</Text>
            </View>
          ) : undefined
        }
      />

      {cargando && (
        <View style={s.centro}><ActivityIndicator color={C.accent} /></View>
      )}

      {!cargando && !!error && (
        <View style={s.centro}>
          <Ionicons name="alert-circle-outline" size={36} color={C.red} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={cargar} style={s.retryBtn} activeOpacity={0.7}>
            <Text style={s.retryText}>{t('tripInProgress.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!cargando && !error && (
        <>
          <LiveMap
            mapRef={mapRef}
            isDark={isDark}
            C={C}
            origen={origen}
            destino={destino}
            conductor={posAuto}
            heading={heading}
            rutaRecorrida={dividida.recorrido}
            rutaRestante={dividida.restante}
            etaDestino={etaDestino}
            textoOrigen={t('tripTracking.markerOrigen')}
            textoDestino={t('tripTracking.markerDestino')}
            pasajeros={pasajerosMapa}
            padding={{ top: altoTop, bottom: altoSheet }}
            onPanDrag={camara.onPanDrag}
          />

          {!camara.siguiendo && (
            <TouchableOpacity
              style={[s.recentrar, { bottom: altoSheet + 14 }]}
              onPress={camara.recentrar}
              activeOpacity={0.8}
            >
              <Ionicons name="locate" size={22} color={C.text} />
            </TouchableOpacity>
          )}

          <TrackingSheet C={C} header={header} onAltoColapsado={setAltoSheet}>
            <View style={s.cuerpo}>
              {enCurso && (
                <View style={[s.trackingBanner, !compartiendo && !!errorUbicacion && s.trackingBannerWarn]}>
                  {compartiendo ? (
                    <>
                      <View style={s.liveDot} />
                      <Text style={s.trackingText}>{t('tripInProgress.compartiendoUbicacion')}</Text>
                    </>
                  ) : errorUbicacion ? (
                    <>
                      <Ionicons name="alert-circle-outline" size={18} color={C.amber} />
                      <Text style={s.trackingError}>{errorUbicacion}</Text>
                    </>
                  ) : (
                    <>
                      <ActivityIndicator size="small" color={C.textSub} />
                      <Text style={s.trackingText}>{t('tripInProgress.conectandoSeguimiento')}</Text>
                    </>
                  )}
                </View>
              )}

              <Text style={s.seccion}>{t('tripInProgress.pasajeros')}</Text>

              {reservas.length === 0 && (
                <View style={s.vacio}>
                  <Ionicons name="people-outline" size={32} color={C.textMuted} />
                  <Text style={s.emptyText}>{t('tripInProgress.emptyPasajeros')}</Text>
                </View>
              )}

              {reservasOrdenadas.map((r) => {
                const procesando = procesandoId === r.id;
                const estadoBadge =
                  r.abordo === true
                    ? { label: t('tripInProgress.badgeAbordo'), color: C.green, bg: 'rgba(61,190,122,0.15)' }
                    : r.abordo === false
                    ? { label: t('tripInProgress.badgeNoPresentado'), color: C.red, bg: 'rgba(224,92,92,0.15)' }
                    : { label: t('tripInProgress.badgePendiente'), color: C.amber, bg: 'rgba(224,184,76,0.15)' };
                const inicial = (r.pasajeroNombre ?? '?').trim().charAt(0).toUpperCase();
                return (
                  <View key={r.id} style={s.card}>
                    <View style={s.cardHeader}>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{inicial}</Text>
                      </View>
                      <View style={s.cardInfo}>
                        <Text style={s.nombre} numberOfLines={1}>{r.pasajeroNombre}</Text>
                        <View style={[s.estadoBadge, { backgroundColor: estadoBadge.bg }]}>
                          <Text style={[s.estadoBadgeText, { color: estadoBadge.color }]}>
                            {estadoBadge.label}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={s.chatBtn}
                        activeOpacity={0.7}
                        onPress={() =>
                          router.push({
                            pathname: '/chat',
                            params: { otroUsuarioId: r.pasajeroId, otroUsuarioNombre: r.pasajeroNombre },
                          })
                        }
                        accessibilityLabel={`${t('tripInProgress.escribirleA')} ${r.pasajeroNombre.split(' ')[0]}`}
                      >
                        <Ionicons name="chatbubble" size={18} color={C.text} />
                      </TouchableOpacity>
                    </View>

                    {!!r.notasPasajero && (
                      <View style={s.notasBox}>
                        <Text style={s.notas}>{r.notasPasajero}</Text>
                      </View>
                    )}

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
                        <Ionicons
                          name="close-circle-outline"
                          size={17}
                          color={r.abordo === false ? C.red : C.textSub}
                        />
                        <Text style={[s.noShowText, r.abordo === false && s.noShowTextActive]}>
                          {t('tripInProgress.noSePresento')}
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
                          <ActivityIndicator color={r.abordo === true ? '#0A0A0A' : C.green} size="small" />
                        ) : (
                          <>
                            <Ionicons
                              name={r.abordo === true ? 'checkmark-circle' : 'shield-checkmark-outline'}
                              size={17}
                              color={r.abordo === true ? '#0A0A0A' : C.green}
                            />
                            <Text style={[s.boardText, r.abordo === true && s.boardTextActive]}>
                              {sinEmoji(r.abordo === true ? t('tripInProgress.badgeAbordo') : t('tripInProgress.verificarYAbordar'))}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </TrackingSheet>
        </>
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
            <View style={s.modalIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={26} color={C.green} />
            </View>
            <Text style={s.modalTitle}>{t('tripInProgress.verificarA')} {verificando?.pasajeroNombre}</Text>
            <Text style={s.modalSub}>
              {t('tripInProgress.pideCodigoMsg')}
            </Text>

            <TextInput
              value={codigoIngresado}
              onChangeText={(v) => {
                setCodigoIngresado(v.replace(/[^0-9]/g, '').slice(0, 4));
                setCodigoError('');
              }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={C.textMuted}
              style={[s.codigoInput, !!codigoError && s.codigoInputError]}
              autoFocus
            />

            {!!codigoError && <Text style={s.modalError}>{codigoError}</Text>}

            <TouchableOpacity
              style={[s.modalConfirmBtn, codigoIngresado.length < 4 && s.disabled]}
              activeOpacity={0.85}
              disabled={codigoIngresado.length < 4}
              onPress={confirmarCodigo}
            >
              <Text style={s.modalConfirmText}>{t('tripInProgress.confirmarCodigo')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.modalGhostBtn} activeOpacity={0.7} onPress={marcarSinCodigo}>
              <Text style={s.modalGhostText}>{t('tripInProgress.noTieneCodigo')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.modalCancelBtn} activeOpacity={0.7} onPress={cerrarVerificacion}>
              <Text style={s.modalCancelText}>{t('tripInProgress.cancelar')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function estilos(C: typeof TRACK_DARK) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: C.sheet },
    errorText: { color: C.red, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
    retryBtn: { borderWidth: 1, borderColor: C.accent, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 9 },
    retryText: { color: C.accent, fontWeight: '600' },

    timerPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.sheet, borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14,
    },
    timerText: { fontSize: 12, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },

    recentrar: {
      position: 'absolute', right: 14, width: 44, height: 44, borderRadius: 22,
      backgroundColor: C.sheet, alignItems: 'center', justifyContent: 'center',
      elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    },

    header: { paddingHorizontal: 20, paddingBottom: 14 },
    tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    titular: { fontSize: 22, fontWeight: '700', color: C.text },
    subtitular: { fontSize: 13, color: C.textSub, marginTop: 3 },
    navegarBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    },
    navegarTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

    statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    statChip: {
      flex: 1, alignItems: 'center', borderRadius: 12,
      paddingVertical: 9, backgroundColor: C.card,
    },
    statValue: { fontSize: 19, fontWeight: '800' },
    statLabel: { fontSize: 11, fontWeight: '600', color: C.textSub, marginTop: 1 },

    finBtn: {
      flexDirection: 'row', gap: 8, marginTop: 14,
      backgroundColor: C.orange, borderRadius: 14, paddingVertical: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    finText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    disabled: { opacity: 0.6 },

    cuerpo: { paddingHorizontal: 20, paddingTop: 6, gap: 12 },
    seccion: { fontSize: 13, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

    trackingBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 11,
      backgroundColor: 'rgba(61,190,122,0.10)',
      borderWidth: 1, borderColor: 'rgba(61,190,122,0.35)',
      borderRadius: 12,
    },
    trackingBannerWarn: {
      backgroundColor: 'rgba(224,184,76,0.10)',
      borderColor: 'rgba(224,184,76,0.35)',
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
    trackingText: { fontSize: 13, color: C.textSub, flex: 1 },
    trackingError: { fontSize: 13, color: C.amber, flex: 1 },

    vacio: { alignItems: 'center', gap: 10, paddingVertical: 28 },
    emptyText: { color: C.textSub, fontSize: 14, textAlign: 'center' },

    card: { backgroundColor: C.card, borderRadius: 14, padding: 14 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 42, height: 42, borderRadius: 21, backgroundColor: C.chip,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 17, fontWeight: '700', color: C.text },
    cardInfo: { flex: 1, alignItems: 'flex-start', gap: 5 },
    nombre: { fontSize: 15, fontWeight: '700', color: C.text, alignSelf: 'stretch' },

    estadoBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
    estadoBadgeText: { fontSize: 11, fontWeight: '700' },

    chatBtn: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: C.chip,
      alignItems: 'center', justifyContent: 'center',
    },

    notasBox: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: C.sheet },
    notas: { fontSize: 13, color: C.textSub, lineHeight: 18 },

    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    },

    noShowBtn:       { borderColor: C.border, backgroundColor: 'transparent' },
    noShowBtnActive: { borderColor: C.red, backgroundColor: 'rgba(224,92,92,0.15)' },
    noShowText:       { color: C.textSub, fontWeight: '600', fontSize: 13 },
    noShowTextActive: { color: C.red },

    boardBtn:       { borderColor: C.green, backgroundColor: 'rgba(61,190,122,0.10)' },
    boardBtnActive: { borderColor: C.green, backgroundColor: C.green },
    boardText:       { color: C.green, fontWeight: '700', fontSize: 13 },
    boardTextActive: { color: '#0A0A0A' },

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    modalCard: {
      width: '100%', maxWidth: 360, backgroundColor: C.sheet, borderRadius: 20,
      borderWidth: 1, borderColor: C.border, padding: 22, alignItems: 'center',
    },
    modalIconWrap: {
      width: 52, height: 52, borderRadius: 26, marginBottom: 12,
      backgroundColor: 'rgba(61,190,122,0.15)',
      alignItems: 'center', justifyContent: 'center',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: C.text, textAlign: 'center' },
    modalSub: {
      fontSize: 13, color: C.textSub, textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 19,
    },
    codigoInput: {
      width: 170, borderWidth: 1, borderColor: C.border, borderRadius: 12,
      paddingVertical: 12, textAlign: 'center', fontSize: 28, fontWeight: '800',
      letterSpacing: 10, color: C.text, backgroundColor: C.card,
    },
    codigoInputError: { borderColor: C.red },
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
