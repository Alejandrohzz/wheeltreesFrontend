import LiveMap from '@/components/tracking/LiveMap';
import TopBar from '@/components/tracking/TopBar';
import TrackingSheet from '@/components/tracking/TrackingSheet';
import { useCamara, useRumbo } from '@/components/tracking/hooks';
import { TRACK_DARK, TRACK_LIGHT } from '@/components/tracking/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useUbicacionViaje } from '@/hooks/useUbicacionViaje';
import { getRoute, LatLng, RouteInfo } from '@/services/directions';
import { dividirRuta, distancia, formatearDistancia, formatearEta, horaLlegada } from '@/services/geo';
import { misReservas, Reserva } from '@/services/reservas';
import { Viaje } from '@/services/types';
import { codigoVerificacion } from '@/services/verificationCode';
import { detalleViaje } from '@/services/viajes';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RADIO_LLEGADA_M = 150;       // a menos de esto del punto de encuentro = "llegó"
const REFRESCO_APROX_MS = 30000;   // cada cuánto recalcula la ruta conductor → punto de encuentro
const REFRESCO_RESERVA_MS = 15000; // cada cuánto revisa si el conductor ya me marcó abordo

export default function TripTrackingScreen() {
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
  const [reserva, setReserva]   = useState<Reserva | null>(null);
  const [aprox, setAprox]       = useState<RouteInfo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [altoTop, setAltoTop]       = useState(insets.top + 56);
  const [altoSheet, setAltoSheet]   = useState(220);
  const finalizadoAvisado = useRef(false);

  const cargar = useCallback(async () => {
    if (!viajeId) return;
    setCargando(true);
    setError('');
    try {
      const v = await detalleViaje(viajeId);
      setViaje(v);
      if (v.origenLat != null && v.origenLng != null && v.destinoLat != null && v.destinoLng != null) {
        try {
          setRuta(await getRoute(
            { lat: v.origenLat, lng: v.origenLng },
            { lat: v.destinoLat, lng: v.destinoLng },
          ));
        } catch { /* sin ruta trazada no es crítico */ }
      }
    } catch (e: any) {
      setError(e?.message ?? t('tripTracking.errorLoad'));
    } finally {
      setCargando(false);
    }
  }, [viajeId]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Ubicación en vivo (bidireccional) ──
  const { conductor, miPosicion, estado: estadoLive, compartiendo, permisoDenegado } = useUbicacionViaje({
    viajeId,
    rol: 'PASAJERO',
    estadoInicial: viaje?.estado,
  });

  const estado = estadoLive ?? viaje?.estado ?? 'PROGRAMADO';
  const enCurso = estado === 'EN_CURSO';

  // ── Mi reserva: de ahí salen el código de abordaje y si ya estoy a bordo ──
  const cargarReserva = useCallback(async () => {
    if (!viajeId) return;
    try {
      const todas = await misReservas();
      setReserva(todas.find((r) => r.viajeId === viajeId && r.estado === 'CONFIRMADA') ?? null);
    } catch { /* la pantalla funciona sin esto */ }
  }, [viajeId]);

  useEffect(() => {
    cargarReserva();
    if (!enCurso) return;
    const id = setInterval(cargarReserva, REFRESCO_RESERVA_MS);
    return () => clearInterval(id);
  }, [cargarReserva, enCurso]);

  const abordo = reserva?.abordo === true;

  // ── Coordenadas ──
  const origen: LatLng | null = viaje?.origenLat != null && viaje?.origenLng != null
    ? { latitude: viaje.origenLat, longitude: viaje.origenLng } : null;
  const destino: LatLng | null = viaje?.destinoLat != null && viaje?.destinoLng != null
    ? { latitude: viaje.destinoLat, longitude: viaje.destinoLng } : null;
  const posConductor: LatLng | null = conductor
    ? { latitude: conductor.lat, longitude: conductor.lng } : null;
  const heading = useRumbo(posConductor);

  const distAlOrigen = posConductor && origen ? distancia(posConductor, origen) : null;
  const llegoAlPunto = distAlOrigen != null && distAlOrigen <= RADIO_LLEGADA_M;
  const vaPorMi = enCurso && !abordo && !!posConductor && !!origen && !llegoAlPunto;

  // ── Ruta conductor → punto de encuentro (la línea negra de "ya va por ti") ──
  const ultimoAprox = useRef(0);
  useEffect(() => {
    if (!vaPorMi || !posConductor || !origen) { setAprox(null); return; }
    if (Date.now() - ultimoAprox.current < REFRESCO_APROX_MS) return;
    ultimoAprox.current = Date.now();
    getRoute(
      { lat: posConductor.latitude, lng: posConductor.longitude },
      { lat: origen.latitude, lng: origen.longitude },
    ).then(setAprox).catch(() => { /* se reintenta en el siguiente movimiento */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaPorMi, posConductor?.latitude, posConductor?.longitude]);

  // ── Divide la ruta y calcula el tiempo restante ──
  const dividida = useMemo(
    () => dividirRuta(ruta?.coordinates ?? [], enCurso && abordo ? posConductor : null),
    [ruta, enCurso, abordo, posConductor?.latitude, posConductor?.longitude],
  );

  const segPorMetro = ruta && ruta.distanceMeters > 0 ? ruta.durationSeconds / ruta.distanceMeters : 0.12;
  const segDestino = ruta
    ? (enCurso && abordo ? dividida.metrosRestantes * segPorMetro : ruta.durationSeconds)
    : null;
  const segOrigen = vaPorMi && aprox ? aprox.durationSeconds : null;

  // Avance del viaje (solo cuando ya voy a bordo): 0 → 1
  const progreso = enCurso && abordo && ruta && ruta.distanceMeters > 0
    ? Math.min(1, Math.max(0, 1 - dividida.metrosRestantes / ruta.distanceMeters))
    : null;

  const etaDestino = segDestino != null ? formatearEta(segDestino) : null;
  const etaOrigen  = segOrigen != null ? formatearEta(segOrigen) : null;

  // ── Cámara ──
  const puntosCamara = useMemo(() => {
    const pts: LatLng[] = [];
    if (posConductor) pts.push(posConductor);
    if (vaPorMi && origen) pts.push(origen);
    else if (destino) pts.push(destino);
    if (!posConductor && origen) pts.push(origen);
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posConductor?.latitude, posConductor?.longitude, vaPorMi, origen?.latitude, destino?.latitude]);

  // Con el viaje en curso la cámara sigue MI ubicación actual.
  const miLatLng: LatLng | null = miPosicion
    ? { latitude: miPosicion.lat, longitude: miPosicion.lng } : null;
  const camara = useCamara(
    mapRef, puntosCamara, { top: altoTop, bottom: altoSheet }, !cargando && !error,
    enCurso ? miLatLng : null,
  );

  // ── Aviso de fin / cancelación (una sola vez) ──
  useEffect(() => {
    if (finalizadoAvisado.current) return;
    if (estado === 'COMPLETADO' || estado === 'CANCELADO') {
      finalizadoAvisado.current = true;
      Alert.alert(
        estado === 'COMPLETADO' ? t('tripTracking.alertFinalizadoTitle') : t('tripTracking.alertCanceladoTitle'),
        estado === 'COMPLETADO' ? t('tripTracking.alertFinalizadoMsg') : t('tripTracking.alertCanceladoMsg'),
        [{ text: t('tripTracking.ok'), onPress: () => router.back() }],
      );
    }
  }, [estado, router]);

  // ── Texto del encabezado del sheet ──
  let titular: string;
  let subtitular: string | null = null;
  let etaGrande: string | null = null;

  if (estado === 'PROGRAMADO') {
    titular = t('tripTracking.estadoProgramado');
    if (viaje?.fechaHoraSalida) {
      subtitular = t('tripTracking.salida', {
        fecha: new Date(viaje.fechaHoraSalida).toLocaleString([], {
          weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
        }),
      });
    }
  } else if (estado === 'COMPLETADO') {
    titular = t('tripTracking.estadoCompletado');
  } else if (estado === 'CANCELADO') {
    titular = t('tripTracking.estadoCancelado');
  } else if (!posConductor) {
    titular = t('tripTracking.hintEsperandoPosicion');
  } else if (abordo) {
    titular = t('tripTracking.enViaje');
    etaGrande = etaDestino;
    if (segDestino != null) {
      subtitular = t('tripTracking.llegadaEstimada', { hora: horaLlegada(segDestino) });
    }
  } else if (llegoAlPunto) {
    titular = t('tripTracking.conductorLlego');
    subtitular = t('tripTracking.conductorLlegoSub');
  } else {
    titular = t('tripTracking.conductorEnCamino');
    etaGrande = etaOrigen;
    if (aprox) subtitular = t('tripTracking.aTuPunto', { dist: formatearDistancia(aprox.distanceMeters) });
  }

  const mostrarCodigo = !!reserva && !abordo && (estado === 'PROGRAMADO' || estado === 'EN_CURSO');
  const nombreCorto = (viaje?.conductorNombre ?? '').split(' ')[0];
  const inicial = (viaje?.conductorNombre ?? '?').trim().charAt(0).toUpperCase();

  const abrirChat = () => {
    if (!viaje) return;
    router.push({
      pathname: '/chat',
      params: { otroUsuarioId: viaje.conductorId, otroUsuarioNombre: viaje.conductorNombre },
    });
  };

  const header = (
    <View style={s.header}>
      <View style={s.tituloFila}>
        <View style={{ flex: 1 }}>
          <Text style={s.titular} numberOfLines={2}>{titular}</Text>
          {!!subtitular && <Text style={s.subtitular} numberOfLines={1}>{subtitular}</Text>}
        </View>
        {!!etaGrande && (
          <View style={s.etaPill}>
            <Text style={s.etaPillTxt}>{etaGrande}</Text>
          </View>
        )}
      </View>

      {progreso != null && (
        <View style={s.barra}><View style={[s.barraRelleno, { width: `${Math.round(progreso * 100)}%` }]} /></View>
      )}

      {!!viaje && (
        <View style={s.conductorFila}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{inicial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.conductorNombre} numberOfLines={1}>{viaje.conductorNombre}</Text>
            <Text style={s.vehiculo} numberOfLines={1}>{viaje.vehiculoDescripcion}</Text>
          </View>
          <View style={s.placa}><Text style={s.placaTxt}>{viaje.vehiculoPlaca}</Text></View>
          <TouchableOpacity
            style={s.circulo}
            onPress={abrirChat}
            activeOpacity={0.7}
            accessibilityLabel={t('tripTracking.escribirA', { nombre: nombreCorto })}
          >
            <Ionicons name="chatbubble" size={18} color={C.text} />
          </TouchableOpacity>
        </View>
      )}

      {mostrarCodigo && reserva && (
        <View style={s.codigoCaja}>
          <View style={{ flex: 1 }}>
            <Text style={s.codigoTitulo}>{t('tripTracking.tuCodigo')}</Text>
            <Text style={s.codigoSub}>{t('tripTracking.codigoHint')}</Text>
          </View>
          <View style={s.codigoDigitos}>
            {codigoVerificacion(reserva.id).split('').map((d, i) => (
              <View key={i} style={s.digito}><Text style={s.digitoTxt}>{d}</Text></View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={s.root}>
      <TopBar
        C={C}
        titulo={viaje ? t('tripTracking.viajeCon', { nombre: nombreCorto }) : t('tripTracking.title')}
        onBack={() => router.back()}
        onAlto={setAltoTop}
      />

      {cargando && (
        <View style={s.centro}><ActivityIndicator color={C.accent} /></View>
      )}

      {!cargando && !!error && (
        <View style={s.centro}>
          <Text style={s.errorTxt}>{error}</Text>
          <TouchableOpacity onPress={cargar} style={s.reintentar} activeOpacity={0.7}>
            <Text style={s.reintentarTxt}>{t('tripTracking.retry')}</Text>
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
            conductor={posConductor}
            heading={heading}
            rutaRecorrida={dividida.recorrido}
            rutaRestante={dividida.restante}
            rutaAproximacion={vaPorMi ? aprox?.coordinates : undefined}
            etaDestino={etaDestino}
            etaOrigen={etaOrigen}
            textoOrigen={t('tripTracking.markerOrigen')}
            textoDestino={t('tripTracking.markerDestino')}
            mostrarMiUbicacion
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
              {/* Línea de tiempo origen → destino */}
              <View style={s.timeline}>
                <View style={s.tlCol}>
                  <View style={s.tlCirculo}><View style={s.tlCirculoIn} /></View>
                  <View style={s.tlLinea} />
                  <View style={s.tlCuadro}><View style={s.tlCuadroIn} /></View>
                </View>
                <View style={{ flex: 1, gap: 22 }}>
                  <View>
                    <Text style={s.tlEtiqueta}>{t('tripTracking.markerOrigen')}</Text>
                    <Text style={s.tlTexto} numberOfLines={2}>{viaje?.origenDescripcion}</Text>
                  </View>
                  <View>
                    <Text style={s.tlEtiqueta}>{t('tripTracking.markerDestino')}</Text>
                    <Text style={s.tlTexto} numberOfLines={2}>{viaje?.destinoDescripcion}</Text>
                  </View>
                </View>
              </View>

              {!!ruta && (
                <View style={s.datosFila}>
                  <View style={s.dato}>
                    <Text style={s.datoValor}>{ruta.distanceText}</Text>
                    <Text style={s.datoLabel}>{t('tripTracking.distancia')}</Text>
                  </View>
                  <View style={s.datoSep} />
                  <View style={s.dato}>
                    <Text style={s.datoValor}>{ruta.durationText}</Text>
                    <Text style={s.datoLabel}>{t('tripTracking.duracion')}</Text>
                  </View>
                  {!!viaje && (
                    <>
                      <View style={s.datoSep} />
                      <View style={s.dato}>
                        <Text style={s.datoValor}>${viaje.aportePorPasajero.toLocaleString()}</Text>
                        <Text style={s.datoLabel}>{t('tripTracking.aporte')}</Text>
                      </View>
                    </>
                  )}
                </View>
              )}

              {!!viaje?.notas && (
                <View style={s.notas}>
                  <Ionicons name="information-circle-outline" size={18} color={C.textSub} />
                  <Text style={s.notasTxt}>{viaje.notas}</Text>
                </View>
              )}

              {enCurso && (
                <View style={s.compartirFila}>
                  {compartiendo ? (
                    <>
                      <View style={[s.punto, { backgroundColor: C.green }]} />
                      <Text style={s.compartirTxt}>{t('tripTracking.compartiendoUbicacion')}</Text>
                    </>
                  ) : permisoDenegado ? (
                    <>
                      <Ionicons name="alert-circle-outline" size={16} color={C.amber} />
                      <Text style={[s.compartirTxt, { color: C.amber }]}>{t('tripTracking.permisoUbicacion')}</Text>
                    </>
                  ) : (
                    <Text style={s.compartirTxt}>{t('tripTracking.conectandoUbicacion')}</Text>
                  )}
                </View>
              )}

              {enCurso && !!conductor?.actualizadaEn && (
                <Text style={s.actualizado}>
                  {t('tripTracking.ultimaActualizacion')} {new Date(conductor.actualizadaEn).toLocaleTimeString()}
                </Text>
              )}
            </View>
          </TrackingSheet>
        </>
      )}
    </View>
  );
}

function estilos(C: typeof TRACK_DARK) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: C.sheet },
    errorTxt: { color: C.red, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
    reintentar: { borderWidth: 1, borderColor: C.accent, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 9 },
    reintentarTxt: { color: C.accent, fontWeight: '600' },

    recentrar: {
      position: 'absolute', right: 14, width: 44, height: 44, borderRadius: 22,
      backgroundColor: C.sheet, alignItems: 'center', justifyContent: 'center',
      elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    },

    header: { paddingHorizontal: 20, paddingBottom: 14 },
    tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    titular: { fontSize: 22, fontWeight: '700', color: C.text },
    subtitular: { fontSize: 14, color: C.textSub, marginTop: 3 },
    etaPill: { backgroundColor: C.green, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
    etaPillTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

    barra: { height: 3, backgroundColor: C.chip, borderRadius: 2, marginTop: 14, overflow: 'hidden' },
    barraRelleno: { height: 3, backgroundColor: C.green },

    conductorFila: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
    },
    avatar: {
      width: 46, height: 46, borderRadius: 23, backgroundColor: C.chip,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarTxt: { fontSize: 19, fontWeight: '700', color: C.text },
    conductorNombre: { fontSize: 16, fontWeight: '700', color: C.text },
    vehiculo: { fontSize: 13, color: C.textSub, marginTop: 2 },
    placa: {
      borderWidth: 1.5, borderColor: C.text, borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    placaTxt: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: C.text },
    circulo: {
      width: 42, height: 42, borderRadius: 21, backgroundColor: C.chip,
      alignItems: 'center', justifyContent: 'center',
    },

    codigoCaja: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: C.card,
    },
    codigoTitulo: { fontSize: 14, fontWeight: '700', color: C.text },
    codigoSub: { fontSize: 12, color: C.textSub, marginTop: 2 },
    codigoDigitos: { flexDirection: 'row', gap: 6 },
    digito: {
      width: 34, height: 42, borderRadius: 8, backgroundColor: C.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    digitoTxt: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },

    cuerpo: { paddingHorizontal: 20, paddingTop: 4, gap: 18 },

    timeline: { flexDirection: 'row', gap: 14, paddingVertical: 6 },
    tlCol: { alignItems: 'center', paddingTop: 4 },
    tlCirculo: {
      width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: C.origin,
      alignItems: 'center', justifyContent: 'center',
    },
    tlCirculoIn: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.origin },
    tlLinea: { width: 2, flex: 1, minHeight: 34, backgroundColor: C.border, marginVertical: 3 },
    tlCuadro: {
      width: 16, height: 16, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
    },
    tlCuadroIn: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' },
    tlEtiqueta: { fontSize: 12, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
    tlTexto: { fontSize: 15, color: C.text, fontWeight: '500', marginTop: 2 },

    datosFila: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.card, borderRadius: 12, paddingVertical: 14,
    },
    dato: { flex: 1, alignItems: 'center' },
    datoValor: { fontSize: 16, fontWeight: '800', color: C.text },
    datoLabel: { fontSize: 11, color: C.textSub, marginTop: 2 },
    datoSep: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: C.border },

    notas: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: C.card },
    notasTxt: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 18 },

    compartirFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    punto: { width: 8, height: 8, borderRadius: 4 },
    compartirTxt: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: C.textSub },
    actualizado: { fontSize: 11, color: C.textMuted },
  });
}
