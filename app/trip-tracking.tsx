import { useAppTheme } from '@/contexts/ThemeContext';
import { getRoute, LatLng } from '@/services/directions';
import {
  conectarTracking,
  desconectarTracking,
  obtenerUbicacion,
  suscribirseAUbicacion,
  UbicacionEvento,
} from '@/services/tracking';
import { Viaje } from '@/services/types';
import { detalleViaje } from '@/services/viajes';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
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
  amber:     '#E0B84C',
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
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road',         elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'water',        elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'poi',          elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'transit',      elementType: 'geometry', stylers: [{ color: '#2f2f2f' }] },
  { featureType: 'landscape',    elementType: 'geometry', stylers: [{ color: '#1c1c1c' }] },
];

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  PROGRAMADO: { label: 'Esperando al conductor', color: DARK_C.amber },
  EN_CURSO:   { label: 'En camino',              color: DARK_C.green },
  COMPLETADO: { label: 'Viaje finalizado',       color: DARK_C.accent },
  CANCELADO:  { label: 'Viaje cancelado',        color: DARK_C.red },
};

function TrackingMap({
  mapRef,
  origen,
  destino,
  vehiculo,
  routeCoords,
}: {
  mapRef: React.RefObject<any>;
  origen: LatLng | null;
  destino: LatLng | null;
  vehiculo: LatLng | null;
  routeCoords: LatLng[];
}) {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);

  if (Platform.OS === 'web') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#1c1c1c' : '#F5F7F8' }]} />;
  }

  const MapView = require('react-native-maps').default;
  const { Marker, Polyline, PROVIDER_DEFAULT } = require('react-native-maps');

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      customMapStyle={isDark ? DARK_MAP_STYLE : []}
      initialRegion={{
        latitude: (origen ?? destino)?.latitude ?? 4.711,
        longitude: (origen ?? destino)?.longitude ?? -74.0721,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
    >
      {routeCoords.length > 0 && (
        <Polyline coordinates={routeCoords} strokeColor={C.accent} strokeWidth={4} geodesic />
      )}

      {origen && <Marker coordinate={origen} pinColor="#9B7BD9" title="Origen" />}
      {destino && <Marker coordinate={destino} pinColor="#3DBE7A" title="Destino" />}

      {vehiculo && (
        <Marker coordinate={vehiculo} anchor={{ x: 0.5, y: 0.5 }} title="Conductor">
          <View style={s.carMarker}>
            <Text style={{ fontSize: 20 }}>🚗</Text>
          </View>
        </Marker>
      )}
    </MapView>
  );
}

export default function TripTrackingScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>();
  const mapRef = useRef<any>(null);

  const [viaje, setViaje]           = useState<Viaje | null>(null);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState('');
  const [evento, setEvento]         = useState<UbicacionEvento | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const finalizadoAvisado = useRef(false);

  const cargar = useCallback(async () => {
    if (!viajeId) return;
    setCargando(true);
    setError('');
    try {
      const [v, ubic] = await Promise.all([
        detalleViaje(viajeId),
        obtenerUbicacion(viajeId).catch(() => null),
      ]);
      setViaje(v);
      if (ubic) setEvento(ubic);

      if (v.origenLat != null && v.origenLng != null && v.destinoLat != null && v.destinoLng != null) {
        try {
          const ruta = await getRoute(
            { lat: v.origenLat, lng: v.origenLng },
            { lat: v.destinoLat, lng: v.destinoLng },
          );
          setRouteCoords(ruta.coordinates);
        } catch {
          // Sin ruta trazada no es crítico: los marcadores igual se ven.
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cargar el viaje');
    } finally {
      setCargando(false);
    }
  }, [viajeId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Conexión en vivo: escucha posiciones y cambios de estado del viaje.
  useEffect(() => {
    if (!viajeId) return;
    let unsuscribir: (() => void) | null = null;
    let activo = true;

    conectarTracking(
      () => {
        if (!activo) return;
        unsuscribir = suscribirseAUbicacion(viajeId, (e) => {
          setEvento(e);
          if (e.estado !== 'EN_CURSO') {
            setViaje((prev) => (prev ? { ...prev, estado: e.estado as any } : prev));
          }
        });
      },
      (err) => { if (activo) setError(err); },
    );

    return () => {
      activo = false;
      unsuscribir?.();
      desconectarTracking();
    };
  }, [viajeId]);

  // Centra el mapa cada vez que llega una posición nueva del conductor.
  useEffect(() => {
    if (evento?.lat != null && evento?.lng != null && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: evento.lat,
          longitude: evento.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500,
      );
    }
  }, [evento?.lat, evento?.lng]);

  // Cuando el viaje termina o se cancela, avisa una sola vez.
  useEffect(() => {
    const estadoActual = evento?.estado ?? viaje?.estado;
    if (!estadoActual || finalizadoAvisado.current) return;
    if (estadoActual === 'COMPLETADO' || estadoActual === 'CANCELADO') {
      finalizadoAvisado.current = true;
      Alert.alert(
        estadoActual === 'COMPLETADO' ? 'Viaje finalizado' : 'Viaje cancelado',
        estadoActual === 'COMPLETADO'
          ? 'El conductor marcó el viaje como completado.'
          : 'El conductor canceló este viaje.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }
  }, [evento?.estado, viaje?.estado, router]);

  const origen  = viaje?.origenLat != null && viaje?.origenLng != null
    ? { latitude: viaje.origenLat, longitude: viaje.origenLng } : null;
  const destino = viaje?.destinoLat != null && viaje?.destinoLng != null
    ? { latitude: viaje.destinoLat, longitude: viaje.destinoLng } : null;
  const vehiculo = evento?.lat != null && evento?.lng != null
    ? { latitude: evento.lat, longitude: evento.lng } : null;

  const estadoActual = evento?.estado ?? viaje?.estado ?? 'PROGRAMADO';
  const infoEstado = ESTADO_LABEL[estadoActual] ?? ESTADO_LABEL.PROGRAMADO;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Seguimiento en vivo</Text>
          {!!viaje && (
            <Text style={s.headerSub} numberOfLines={1}>
              {viaje.origenDescripcion} → {viaje.destinoDescripcion}
            </Text>
          )}
        </View>
      </View>

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

      {!cargando && !error && (
        <View style={{ flex: 1 }}>
          <TrackingMap
            mapRef={mapRef}
            origen={origen}
            destino={destino}
            vehiculo={vehiculo}
            routeCoords={routeCoords}
          />

          <View style={s.bottomCard}>
            <View style={s.estadoRow}>
              <View style={[s.estadoDot, { backgroundColor: infoEstado.color }]} />
              <Text style={[s.estadoText, { color: infoEstado.color }]}>{infoEstado.label}</Text>
            </View>

            {!!viaje && (
              <>
                <Text style={s.conductorNombre}>{viaje.conductorNombre}</Text>
                <Text style={s.vehiculoInfo}>
                  {viaje.vehiculoDescripcion} · {viaje.vehiculoPlaca}
                </Text>
              </>
            )}

            {estadoActual === 'PROGRAMADO' && (
              <Text style={s.hint}>El mapa se activará apenas el conductor inicie el viaje.</Text>
            )}
            {estadoActual === 'EN_CURSO' && !vehiculo && (
              <Text style={s.hint}>Esperando la primera posición del conductor…</Text>
            )}
            {estadoActual === 'EN_CURSO' && evento?.actualizadaEn && (
              <Text style={s.hint}>
                Última actualización: {new Date(evento.actualizadaEn).toLocaleTimeString()}
              </Text>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    backgroundColor: C.bg, zIndex: 5,
  },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: C.text },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  headerSub:   { fontSize: 12, color: C.textMuted, marginTop: 1 },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: C.red, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: {
    borderWidth: 1, borderColor: C.accent, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  retryText: { color: C.accent, fontWeight: '600' },

  carMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.card, borderWidth: 2, borderColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  bottomCard: {
    position: 'absolute', left: 16, right: 16, bottom: 16,
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 4,
  },
  estadoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  estadoDot: { width: 8, height: 8, borderRadius: 4 },
  estadoText: { fontSize: 13, fontWeight: '700' },
  conductorNombre: { fontSize: 16, fontWeight: '700', color: C.text },
  vehiculoInfo: { fontSize: 13, color: C.textSub, marginTop: 2 },
  hint: { fontSize: 12, color: C.textMuted, marginTop: 6 },
});
}
