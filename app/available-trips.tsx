import { useAppTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { getRoute, LatLng } from '@/services/directions';
import { solicitarReserva } from '@/services/reservas';
import { Viaje } from '@/services/types';
import { listarViajes } from '@/services/viajes';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

const DARK_C = {
  bg: '#131517',
  card: '#1E2126',
  border: '#2E343C',
  text: '#FFFFFF',
  muted: '#9BA3AD',
  green: '#3DBE7A',
  blue: '#4A90D9',
  orange: '#DA6720',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  card: '#FFFFFF',
  border: '#DDE1E6',
  text: '#11181C',
  muted: '#5B6472',
  green: '#3DBE7A',
  blue: '#4A90D9',
  orange: '#DA6720',
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f2f2f' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1c1c1c' }] },
];

type ViajeConRuta = Viaje & { routeCoords?: LatLng[] };

function AvailableTripsMap({
  viajes,
  selectedId,
  onSelect,
}: {
  viajes: ViajeConRuta[];
  selectedId: string | null;
  onSelect: (viaje: ViajeConRuta) => void;
}) {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);

  if (Platform.OS === 'web') {
    return (
      <View style={s.mapFallback}>
        <Ionicons name="map-outline" size={34} color={C.muted} />
        <Text style={s.mapFallbackText}>Mapa disponible en la aplicación móvil</Text>
      </View>
    );
  }

  const MapView = require('react-native-maps').default;
  const { Polyline, Marker, Callout, PROVIDER_DEFAULT, PROVIDER_GOOGLE } = require('react-native-maps');
  const mapProvider = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      provider={mapProvider}
      customMapStyle={isDark ? DARK_MAP_STYLE : []}
      initialRegion={{
        latitude: 4.711,
        longitude: -74.0721,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }}
      showsUserLocation
      showsMyLocationButton
      showsCompass={false}
      toolbarEnabled={false}
    >
      {viajes.map((viaje) => (
        <View key={viaje.id}>
          {viaje.routeCoords && viaje.routeCoords.length > 0 && (
            <Polyline
              coordinates={viaje.routeCoords}
              strokeColor={selectedId === viaje.id ? C.blue : C.green}
              strokeWidth={selectedId === viaje.id ? 5 : 4}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
          )}

          {viaje.origenLat != null && viaje.origenLng != null && (
            <Marker
              coordinate={{ latitude: viaje.origenLat, longitude: viaje.origenLng }}
              pinColor={C.green}
              onPress={() => onSelect(viaje)}
            >
              <Callout onPress={() => onSelect(viaje)}>
                <View style={{ maxWidth: 230 }}>
                  <Text style={s.calloutTitle}>{viaje.conductorNombre}</Text>
                  <Text style={s.calloutText}>{viaje.origenDescripcion}</Text>
                  <Text style={s.calloutText}>→ {viaje.destinoDescripcion}</Text>
                  <Text style={s.calloutText}>
                    {viaje.cuposDisponibles} cupos · ${viaje.aportePorPasajero}
                  </Text>
                </View>
              </Callout>
            </Marker>
          )}

          {viaje.destinoLat != null && viaje.destinoLng != null && (
            <Marker
              coordinate={{ latitude: viaje.destinoLat, longitude: viaje.destinoLng }}
              pinColor={C.orange}
              onPress={() => onSelect(viaje)}
            />
          )}
        </View>
      ))}
    </MapView>
  );
}

export default function AvailableTripsScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { usuario } = useAuth();
  const [viajes, setViajes] = useState<ViajeConRuta[]>([]);
  const [viajeSeleccionado, setViajeSeleccionado] = useState<ViajeConRuta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [reservandoId, setReservandoId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await listarViajes();
      const disponibles = data
        .filter(
          (v) =>
            v.estado === 'PROGRAMADO' &&
            v.cuposDisponibles > 0 &&
            v.conductorId !== usuario?.id &&
            v.origenLat != null &&
            v.origenLng != null
        )
        .sort(
          (a, b) =>
            new Date(a.fechaHoraSalida).getTime() - new Date(b.fechaHoraSalida).getTime()
        );

      const conRutas = await Promise.all(
        disponibles.map(async (viaje) => {
          if (viaje.destinoLat == null || viaje.destinoLng == null) return viaje;
          try {
            const info = await getRoute(
              { lat: viaje.origenLat!, lng: viaje.origenLng! },
              { lat: viaje.destinoLat, lng: viaje.destinoLng }
            );
            return { ...viaje, routeCoords: info.coordinates };
          } catch {
            return viaje;
          }
        })
      );

      setViajes(conRutas);
      setViajeSeleccionado((actual) =>
        actual && conRutas.some((v) => v.id === actual.id) ? actual : null
      );
    } catch (e: any) {
      setError(e?.message ?? 'No se pudieron cargar los viajes disponibles');
    } finally {
      setCargando(false);
    }
  }, [usuario?.id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const reservar = async (viaje: Viaje) => {
    setReservandoId(viaje.id);
    try {
      await solicitarReserva({ viajeId: viaje.id });
      Alert.alert('Reserva enviada', 'Tu solicitud de reserva fue enviada correctamente.');
      setViajeSeleccionado(null);
      await cargar();
    } catch (e: any) {
      Alert.alert('No se pudo reservar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setReservandoId(null);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} activeOpacity={0.7}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Viajes disponibles</Text>
        <View style={{ width: 40 }} />
      </View>

      {cargando ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.green} />
          <Text style={s.loadingText}>Cargando viajes y rutas...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.error}>{error}</Text>
          <TouchableOpacity onPress={cargar} style={s.retry}>
            <Text style={s.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* El mapa ocupa la parte superior, igual que la vista de ruta del flujo de publicación. */}
          <View style={s.mapContainer}>
            <AvailableTripsMap
              viajes={viajes}
              selectedId={viajeSeleccionado?.id ?? null}
              onSelect={setViajeSeleccionado}
            />
            <View style={s.mapBadge}>
              <Text style={s.mapBadgeText}>{viajes.length} viaje(s) disponible(s)</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
          >
            {viajes.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>No hay viajes disponibles</Text>
                <Text style={s.emptyText}>
                  Cuando un conductor publique un viaje con cupos disponibles, aparecerá aquí y en el mapa.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.sectionTitle}>Selecciona un viaje</Text>
                {viajes.map((viaje) => {
                  const seleccionado = viajeSeleccionado?.id === viaje.id;
                  return (
                    <TouchableOpacity
                      key={viaje.id}
                      style={[s.card, seleccionado && s.cardSelected]}
                      onPress={() => setViajeSeleccionado(viaje)}
                      activeOpacity={0.85}
                    >
                      <View style={s.cardHeader}>
                        <Text style={s.driver}>{viaje.conductorNombre}</Text>
                        <Text style={s.price}>${viaje.aportePorPasajero}</Text>
                      </View>
                      <Text style={s.route}>{viaje.origenDescripcion}</Text>
                      <Text style={s.arrow}>↓</Text>
                      <Text style={s.route}>{viaje.destinoDescripcion}</Text>

                      <View style={s.infoRow}>
                        <Text style={s.info}>
                          {new Date(viaje.fechaHoraSalida).toLocaleString('es-CO', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Text>
                        <Text style={s.seats}>{viaje.cuposDisponibles} cupo(s)</Text>
                      </View>

                      {seleccionado && (
                        <TouchableOpacity
                          style={s.reserve}
                          disabled={reservandoId === viaje.id}
                          onPress={() => reservar(viaje)}
                          activeOpacity={0.8}
                        >
                          {reservandoId === viaje.id ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={s.reserveText}>Solicitar reserva</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  back: { width: 40, height: 40, justifyContent: 'center' },
  backText: { color: C.text, fontSize: 38, lineHeight: 40, fontWeight: '300' },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  mapContainer: { height: 330, overflow: 'hidden' },
  mapBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(19,21,23,0.9)',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  mapBadgeText: { color: C.text, fontSize: 12, fontWeight: '700' },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1c',
    gap: 8,
  },
  mapFallbackText: { color: C.muted, fontSize: 13 },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 12 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardSelected: { borderColor: C.blue, backgroundColor: '#1C242C' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  driver: { color: C.text, fontSize: 17, fontWeight: '800' },
  route: { color: C.text, fontSize: 14, lineHeight: 21 },
  arrow: { color: C.green, fontSize: 18, marginVertical: 2 },
  infoRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: { color: C.muted, fontSize: 12, flex: 1 },
  price: { color: C.green, fontSize: 16, fontWeight: '800' },
  seats: { color: C.muted, fontSize: 12 },
  reserve: {
    backgroundColor: C.green,
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  reserveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: C.muted, marginTop: 10 },
  error: { color: '#E05C5C', textAlign: 'center', marginBottom: 14 },
  retry: { backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  empty: { padding: 28, alignItems: 'center' },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: C.muted, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  calloutTitle: { fontWeight: '700', marginBottom: 2 },
  calloutText: { fontSize: 12, marginTop: 2 },
});
}
