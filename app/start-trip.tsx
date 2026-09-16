import { SlideToConfirm } from '@/components/atoms';
import { useAppTheme } from '@/contexts/ThemeContext';
import { getRoute, LatLng } from '@/services/directions';
import { guardarInicioViaje } from '@/services/tripTimer';
import { Viaje } from '@/services/types';
import { detalleViaje, iniciarViaje } from '@/services/viajes';
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

function RouteMap({
  mapRef,
  origen,
  destino,
  routeCoords,
  isDark,
}: {
  mapRef: React.RefObject<any>;
  origen: LatLng | null;
  destino: LatLng | null;
  routeCoords: LatLng[];
  isDark: boolean;
}) {
  const C = isDark ? DARK_C : LIGHT_C;

  if (Platform.OS === 'web') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#1c1c1c' : '#F5F7F8' }]} />;
  }

  const MapView = require('react-native-maps').default;
  const { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } = require('react-native-maps');
  const mapProvider = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={mapProvider}
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
      onLayout={() => {
        if (routeCoords.length > 1 && mapRef.current) {
          mapRef.current.fitToCoordinates(routeCoords, {
            edgePadding: { top: 80, right: 60, bottom: 220, left: 60 },
            animated: true,
          });
        }
      }}
    >
      {routeCoords.length > 0 && (
        <Polyline coordinates={routeCoords} strokeColor={C.accent} strokeWidth={4} geodesic />
      )}

      {origen && <Marker coordinate={origen} pinColor="#9B7BD9" title="Origen" />}
      {destino && <Marker coordinate={destino} pinColor="#3DBE7A" title="Destino" />}
    </MapView>
  );
}

export default function StartTripScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>();
  const mapRef = useRef<any>(null);

  const [viaje, setViaje]       = useState<Viaje | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [iniciando, setIniciando] = useState(false);

  const cargar = useCallback(async () => {
    if (!viajeId) return;
    setCargando(true);
    setError('');
    try {
      const v = await detalleViaje(viajeId);
      setViaje(v);

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

  const origen  = viaje?.origenLat != null && viaje?.origenLng != null
    ? { latitude: viaje.origenLat, longitude: viaje.origenLng } : null;
  const destino = viaje?.destinoLat != null && viaje?.destinoLng != null
    ? { latitude: viaje.destinoLat, longitude: viaje.destinoLng } : null;

  const handleIniciar = async () => {
    if (!viajeId) return;
    setIniciando(true);
    try {
      await iniciarViaje(viajeId);
      // Guardamos el momento real de inicio para el contador de minutos
      // en "Viaje en curso".
      await guardarInicioViaje(viajeId);
      router.replace('/home');
    } catch (e: any) {
      setIniciando(false);
      Alert.alert('No se pudo iniciar el viaje', e?.message ?? 'Inténtalo de nuevo');
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Iniciar viaje</Text>
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
          <RouteMap
            mapRef={mapRef}
            origen={origen}
            destino={destino}
            routeCoords={routeCoords}
            isDark={isDark}
          />

          <View style={s.bottomCard}>
            {!!viaje && (
              <>
                <Text style={s.ruta}>{viaje.origenDescripcion} → {viaje.destinoDescripcion}</Text>
                <Text style={s.detail}>
                  {new Date(viaje.fechaHoraSalida).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Text>
                <Text style={s.detail}>
                  {viaje.vehiculoDescripcion} · {viaje.cuposDisponibles}/{viaje.cuposTotales} cupos libres
                </Text>
              </>
            )}

            <View style={s.slideWrap}>
              <SlideToConfirm
                label="Desliza para iniciar viaje →"
                confirmingLabel="Iniciando…"
                icon=""
                loading={iniciando}
                onConfirm={handleIniciar}
                colors={{
                  track: 'transparent',
                  trackBorder: C.green,
                  fill: 'rgba(61,190,122,0.18)',
                  thumb: C.green,
                  thumbIcon: '#0A0A0A',
                  label: C.green,
                  disabledTrack: 'transparent',
                }}
              />
            </View>
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

  bottomCard: {
    position: 'absolute', left: 16, right: 16, bottom: 16,
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border,
    padding: 18, gap: 4,
  },
  ruta:   { fontSize: 16, fontWeight: '700', color: C.text },
  detail: { fontSize: 13, color: C.textSub, marginTop: 2 },

  slideWrap: { marginTop: 14 },
});
}
