import { useAuth } from '@/context/AuthContext';
import { getRoute, LatLng, RouteInfo } from '@/services/directions';
import { PlaceLatLng } from '@/services/places';
import { misReservas, solicitarReserva } from '@/services/reservas';
import {
  conectarTracking,
  desconectarTracking,
  enviarUbicacion,
  suscribirseAUbicacion,
} from '@/services/tracking';
import { Viaje } from '@/services/types';
import {
  completarViaje,
  detalleViaje,
  listarMisViajes,
  listarViajes,
} from '@/services/viajes';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const C = {
  bg:          '#131517',
  surface:     '#1E2126',
  border:      '#2E343C',
  text:        '#FFFFFF',
  textMuted:   '#6B7785',
  accentGreen: '#3DBE7A',
  accent:      '#4A90D9',
  iconMuted:   '#4A5160',
};

const BOGOTA_FALLBACK: PlaceLatLng = { lat: 4.711, lng: -74.0721 };

// Ubicación fija de Universidad El Bosque, usada para precargar el
// formulario de publicar viaje desde los accesos rápidos.
const UNIVERSIDAD = {
  descripcion: 'Universidad El Bosque, Avenida Carrera 9, Bogotá, Colombia',
  lat: 4.7103137,
  lng: -74.0322043,
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

type ViajeConRuta = Viaje & { routeCoords?: LatLng[] };

function MapBackground({
  mapRef,
  routeCoords,
  viajesPublicados,
  onSelectViaje,
  esPasajero,
  rutaActivaCoords,
  origenActivo,
  destinoActivo,
  vehiculoActivo,
}: {
  mapRef: React.RefObject<any>;
  routeCoords: LatLng[];
  viajesPublicados: ViajeConRuta[];
  onSelectViaje: (v: ViajeConRuta) => void;
  esPasajero: boolean;
  rutaActivaCoords: LatLng[];
  origenActivo: LatLng | null;
  destinoActivo: LatLng | null;
  vehiculoActivo: LatLng | null;
}) {
  if (Platform.OS === 'web') {
    return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1c1c1c' }]} />;
  }

  const MapView = require('react-native-maps').default;
  const { Polyline, Marker, Callout, PROVIDER_DEFAULT } = require('react-native-maps');

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_DEFAULT}
      customMapStyle={DARK_MAP_STYLE}
      initialRegion={{
        latitude: 4.711,
        longitude: -74.0721,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
    >
      {routeCoords.length > 0 && (
        <>
          <Polyline
            coordinates={routeCoords}
            strokeColor={C.accentGreen}
            strokeWidth={4}
          />
          <Marker
            coordinate={routeCoords[routeCoords.length - 1]}
            pinColor="#4A90D9"
          />
        </>
      )}

      {/* ── VIAJES PUBLICADOS ─────────────────────────────────────────── */}
      {viajesPublicados.map((v) => (
        <View key={v.id}>
          {v.routeCoords && v.routeCoords.length > 0 && (
            <Polyline
              coordinates={v.routeCoords}
              strokeColor={C.accentGreen}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
          )}

          <Marker
            coordinate={{
              latitude: v.origenLat!,
              longitude: v.origenLng!,
            }}
            pinColor="#3DBE7A"
            onPress={() => onSelectViaje(v)}
          >
            <Callout onPress={() => onSelectViaje(v)}>
              <View style={{ maxWidth: 220 }}>
                <Text style={{ fontWeight: '700', marginBottom: 2 }}>
                  {v.conductorNombre}
                </Text>

                <Text style={{ fontSize: 12 }}>
                  {v.origenDescripcion}
                </Text>

                <Text style={{ fontSize: 12 }}>
                  → {v.destinoDescripcion}
                </Text>

                <Text style={{ fontSize: 12, marginTop: 2 }}>
                  {v.cuposDisponibles} cupos · ${v.aportePorPasajero}
                </Text>

                {esPasajero && (
                  <Text
                    style={{
                      fontSize: 11,
                      marginTop: 4,
                      color: '#3DBE7A',
                      fontWeight: '700',
                    }}
                  >
                    Toca para ver y reservar →
                  </Text>
                )}
              </View>
            </Callout>
          </Marker>

          {v.destinoLat != null && v.destinoLng != null && (
            <Marker
              coordinate={{
                latitude: v.destinoLat,
                longitude: v.destinoLng,
              }}
              pinColor="#9B7BD9"
              onPress={() => onSelectViaje(v)}
            />
          )}
        </View>
      ))}

      {/* ── VIAJE EN CURSO: ubicación en vivo del conductor ─────────── */}
      {rutaActivaCoords.length > 0 && (
        <Polyline
          coordinates={rutaActivaCoords}
          strokeColor={C.accent}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
          geodesic
        />
      )}

      {origenActivo && (
        <Marker coordinate={origenActivo} pinColor="#9B7BD9" title="Origen" />
      )}

      {destinoActivo && (
        <Marker coordinate={destinoActivo} pinColor="#3DBE7A" title="Destino" />
      )}

      {vehiculoActivo && (
        <Marker
          coordinate={vehiculoActivo}
          anchor={{ x: 0.5, y: 0.5 }}
          title="Conductor"
        >
          <View style={s.carMarker}>
            <Text style={{ fontSize: 18 }}>🚗</Text>
          </View>
        </Marker>
      )}
    </MapView>
  );
}

export default function HomeScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const mapRef = useRef<any>(null);

  const [activeTab, setActiveTab] = useState<
    'map' | 'locate' | 'profile'
  >('map');

  const [origenLL, setOrigenLL] =
    useState<PlaceLatLng | null>(null);

  const [ruta, setRuta] =
    useState<RouteInfo | null>(null);

  const [cargandoRuta, setCargandoRuta] =
    useState(false);

  const [rutaError, setRutaError] =
    useState('');

  const [viajesPublicados, setViajesPublicados] =
    useState<ViajeConRuta[]>([]);

  // Detalle / reserva del viaje seleccionado en el mapa
  const [viajeSeleccionado, setViajeSeleccionado] =
    useState<ViajeConRuta | null>(null);

  const [notasReserva, setNotasReserva] =
    useState('');

  const [reservando, setReservando] =
    useState(false);

  const [reservaError, setReservaError] =
    useState('');

  const [reservaOk, setReservaOk] =
    useState(false);

  // ── VIAJE EN CURSO: ubicación en tiempo real ─────────────────────────
  // Viaje EN_CURSO del usuario (como conductor o como pasajero con
  // reserva confirmada), para pintar la ubicación en vivo en el mapa
  // de home sin tener que entrar a la pantalla de seguimiento.
  const [viajeActivo, setViajeActivo] =
    useState<Viaje | null>(null);

  const [vehiculoActivo, setVehiculoActivo] =
    useState<LatLng | null>(null);

  const [rutaActivaCoords, setRutaActivaCoords] =
    useState<LatLng[]>([]);

  const [compartiendoUbicacion, setCompartiendoUbicacion] =
    useState(false);

  const [finalizandoViaje, setFinalizandoViaje] =
    useState(false);

  const centradoInicialHecho = useRef(false);

  // ── ROLES ───────────────────────────────────────────────────────────
  // Ahora el rol real del usuario determina qué funcionalidades puede ver.
  const esConductor = usuario?.rol === 'CONDUCTOR';
  const esPasajero = usuario?.rol === 'PASAJERO';

  const nombreMostrado = usuario?.nombre ?? 'Usuario';

  // Carga los viajes activos con coordenadas y calcula la ruta
  useFocusEffect(
    useCallback(() => {
      let cancelado = false;

      (async () => {
        try {
          const data = await listarViajes();

          if (cancelado) return;

          const conCoords = data.filter(
            (v) =>
              v.estado === 'PROGRAMADO' &&
              v.origenLat != null &&
              v.origenLng != null
          );

          setViajesPublicados(conCoords);

          const conRuta = await Promise.all(
            conCoords.map(async (v) => {
              if (
                v.destinoLat == null ||
                v.destinoLng == null
              ) {
                return v;
              }

              try {
                const info = await getRoute(
                  {
                    lat: v.origenLat!,
                    lng: v.origenLng!,
                  },
                  {
                    lat: v.destinoLat,
                    lng: v.destinoLng,
                  }
                );

                return {
                  ...v,
                  routeCoords: info.coordinates,
                };
              } catch {
                return v;
              }
            })
          );

          if (!cancelado) {
            setViajesPublicados(conRuta);
          }
        } catch {
          // Silencioso
        }
      })();

      return () => {
        cancelado = true;
      };
    }, [])
  );

  // Detecta si el usuario tiene un viaje EN_CURSO en este momento (como
  // conductor o como pasajero con reserva confirmada), para activar el
  // seguimiento en vivo sobre el mapa de home.
  useFocusEffect(
    useCallback(() => {
      let cancelado = false;

      (async () => {
        try {
          let activo: Viaje | null = null;

          if (esConductor) {
            const misViajes = await listarMisViajes();
            activo =
              misViajes.find((v) => v.estado === 'EN_CURSO') ?? null;
          } else if (esPasajero) {
            const reservas = await misReservas();
            const confirmadas = reservas.filter(
              (r) => r.estado === 'CONFIRMADA'
            );

            for (const r of confirmadas) {
              try {
                const v = await detalleViaje(r.viajeId);
                if (v.estado === 'EN_CURSO') {
                  activo = v;
                  break;
                }
              } catch {
                // Se ignora ese viaje puntual y se sigue con el siguiente
              }
            }
          }

          if (cancelado) return;

          setViajeActivo(activo);

          if (
            activo?.ubicacionLat != null &&
            activo?.ubicacionLng != null
          ) {
            setVehiculoActivo({
              latitude: activo.ubicacionLat,
              longitude: activo.ubicacionLng,
            });
          }

          if (!activo) {
            setVehiculoActivo(null);
            setRutaActivaCoords([]);
            centradoInicialHecho.current = false;
          }
        } catch {
          // Silencioso: sin viaje en curso detectado
        }
      })();

      return () => {
        cancelado = true;
      };
    }, [esConductor, esPasajero])
  );

  // Traza la ruta del viaje activo (origen → destino) para mostrarla
  // de fondo mientras se sigue la posición en vivo del conductor.
  useEffect(() => {
    let cancelado = false;

    if (
      !viajeActivo ||
      viajeActivo.origenLat == null ||
      viajeActivo.origenLng == null ||
      viajeActivo.destinoLat == null ||
      viajeActivo.destinoLng == null
    ) {
      setRutaActivaCoords([]);
      return;
    }

    (async () => {
      try {
        const info = await getRoute(
          { lat: viajeActivo.origenLat!, lng: viajeActivo.origenLng! },
          { lat: viajeActivo.destinoLat!, lng: viajeActivo.destinoLng! }
        );
        if (!cancelado) setRutaActivaCoords(info.coordinates);
      } catch {
        if (!cancelado) setRutaActivaCoords([]);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [viajeActivo?.id]);

  // Conexión en vivo: mientras haya un viaje EN_CURSO, se escucha (y si
  // soy el conductor, también se publica) la posición GPS en tiempo real
  // directamente sobre el mapa de home.
  useEffect(() => {
    if (!viajeActivo || Platform.OS === 'web') return;

    let activoEfecto = true;
    let unsuscribir: (() => void) | null = null;
    let watcher: Location.LocationSubscription | null = null;

    conectarTracking(
      async () => {
        if (!activoEfecto) return;

        unsuscribir = suscribirseAUbicacion(
          viajeActivo.id,
          (e) => {
            if (e.lat != null && e.lng != null) {
              setVehiculoActivo({
                latitude: e.lat,
                longitude: e.lng,
              });
            }

            if (e.estado !== 'EN_CURSO') {
              // El conductor finalizó o canceló: se retira del mapa.
              setViajeActivo(null);
              setVehiculoActivo(null);
              setRutaActivaCoords([]);
            }
          }
        );

        // Si soy el conductor de este viaje, además comparto mi GPS.
        if (
          esConductor &&
          viajeActivo.conductorId === usuario?.id
        ) {
          const { status } =
            await Location.requestForegroundPermissionsAsync();

          if (status === 'granted' && activoEfecto) {
            setCompartiendoUbicacion(true);

            watcher = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.High,
                timeInterval: 4000,
                distanceInterval: 15,
              },
              (pos) => {
                enviarUbicacion(
                  viajeActivo.id,
                  pos.coords.latitude,
                  pos.coords.longitude
                );
                setVehiculoActivo({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              }
            );
          }
        }
      },
      () => {
        // Error de conexión: se reintenta solo (reconnectDelay del cliente STOMP)
      }
    );

    return () => {
      activoEfecto = false;
      watcher?.remove();
      unsuscribir?.();
      desconectarTracking();
      setCompartiendoUbicacion(false);
    };
  }, [viajeActivo?.id, esConductor, usuario?.id]);

  // Centra el mapa sobre el vehículo en cuanto llega su primera posición
  // en vivo, y lo sigue suavemente en cada actualización posterior.
  useEffect(() => {
    if (!vehiculoActivo || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: vehiculoActivo.latitude,
        longitude: vehiculoActivo.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500
    );

    centradoInicialHecho.current = true;
  }, [vehiculoActivo?.latitude, vehiculoActivo?.longitude]);

  // Ubicación actual del usuario
  useEffect(() => {
    (async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          setOrigenLL(BOGOTA_FALLBACK);
          return;
        }

        const pos =
          await Location.getCurrentPositionAsync({});

        setOrigenLL({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      } catch {
        setOrigenLL(BOGOTA_FALLBACK);
      }
    })();
  }, []);

  const trazarRutaHacia = async (
    destinoLL: PlaceLatLng
  ) => {
    if (!origenLL) return;

    setCargandoRuta(true);
    setRutaError('');

    try {
      const info = await getRoute(
        origenLL,
        destinoLL
      );

      setRuta(info);

      if (
        mapRef.current &&
        info.coordinates.length > 0
      ) {
        mapRef.current.fitToCoordinates(
          info.coordinates,
          {
            edgePadding: {
              top: 140,
              right: 60,
              bottom: 340,
              left: 60,
            },
            animated: true,
          }
        );
      }
    } catch (e: any) {
      setRutaError(
        e?.message ?? 'No se pudo calcular la ruta'
      );
      setRuta(null);
    } finally {
      setCargandoRuta(false);
    }
  };

  // El conductor finaliza el viaje EN_CURSO directamente desde el home,
  // sin tener que entrar a la pantalla de gestión del viaje.
  const finalizarViajeDesdeHome = () => {
    if (!viajeActivo) return;

    Alert.alert(
      'Finalizar viaje',
      '¿Confirmas que el viaje terminó? Se marcará como completado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            setFinalizandoViaje(true);
            try {
              await completarViaje(viajeActivo.id);
              setViajeActivo(null);
              setVehiculoActivo(null);
              setRutaActivaCoords([]);
            } catch (e: any) {
              Alert.alert(
                'No se pudo finalizar',
                e?.message ?? 'Inténtalo de nuevo'
              );
            } finally {
              setFinalizandoViaje(false);
            }
          },
        },
      ]
    );
  };

  const irADetalleViaje = (
    v: ViajeConRuta
  ) => {
    setViajeSeleccionado(v);
    setNotasReserva('');
    setReservaError('');
    setReservaOk(false);

    if (
      v.destinoLat != null &&
      v.destinoLng != null
    ) {
      trazarRutaHacia({
        lat: v.destinoLat,
        lng: v.destinoLng,
      });
    }
  };

  const confirmarReserva = async () => {
    if (!viajeSeleccionado) return;

    setReservando(true);
    setReservaError('');

    try {
      await solicitarReserva({
        viajeId: viajeSeleccionado.id,
        notasPasajero:
          notasReserva.trim() || undefined,
      });

      setReservaOk(true);
    } catch (e: any) {
      setReservaError(
        e?.message ?? 'No se pudo crear la reserva'
      );
    } finally {
      setReservando(false);
    }
  };

  const cerrarDetalleViaje = () => {
    setViajeSeleccionado(null);
    setReservaOk(false);
    setReservaError('');
  };

  // ── NAVEGACIÓN INFERIOR ─────────────────────────────────────────────
  const handleTabPress = (
    tab: 'map' | 'locate' | 'profile'
  ) => {
    setActiveTab(tab);

    if (tab === 'profile') {
      router.push('/profile');
    }

    if (tab === 'map') {
      // Botón inferior izquierdo:
      // PASAJERO -> viajes disponibles
      // CONDUCTOR -> mis viajes
      if (esPasajero) {
        router.push('/available-trips');
      } else if (esConductor) {
        router.push('/my-trips');
      }
    }
  };

  return (
    <View style={s.root}>

      <MapBackground
        mapRef={mapRef}
        routeCoords={ruta?.coordinates ?? []}
        viajesPublicados={viajesPublicados}
        onSelectViaje={irADetalleViaje}
        esPasajero={esPasajero}
        rutaActivaCoords={rutaActivaCoords}
        origenActivo={
          viajeActivo?.origenLat != null && viajeActivo?.origenLng != null
            ? { latitude: viajeActivo.origenLat, longitude: viajeActivo.origenLng }
            : null
        }
        destinoActivo={
          viajeActivo?.destinoLat != null && viajeActivo?.destinoLng != null
            ? { latitude: viajeActivo.destinoLat, longitude: viajeActivo.destinoLng }
            : null
        }
        vehiculoActivo={vehiculoActivo}
      />

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <SafeAreaView style={s.safeHeader}>
        <View style={s.header}>

          <TouchableOpacity
            style={s.avatarBtn}
            onPress={() => router.push('/profile')}
            activeOpacity={0.8}
          >
            <Text style={s.avatarInitial}>
              {nombreMostrado
                .charAt(0)
                .toUpperCase()}
            </Text>
          </TouchableOpacity>

          <Text style={s.greeting}>
            Hello,{' '}
            <Text style={s.greetingName}>
              {nombreMostrado}
            </Text>
          </Text>

          <View style={{ flex: 1 }} />

          {/* CHAT - TODOS */}
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => router.push('/chats')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={20}
              color={C.accentGreen}
            />
          </TouchableOpacity>

          {/* NOTIFICACIONES - SOLO CONDUCTOR */}
          {esConductor && (
            <TouchableOpacity
              style={s.bellBtn}
              onPress={() =>
                router.push('/notifications')
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="notifications"
                size={20}
                color={C.accentGreen}
              />
            </TouchableOpacity>
          )}

          {/* RESERVAS - SOLO PASAJERO */}
          {esPasajero && (
            <TouchableOpacity
              style={s.bellBtn}
              onPress={() =>
                router.push('/my-reservations')
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="ticket"
                size={20}
                color={C.accentGreen}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* ── VIAJE EN CURSO: banner de ubicación en vivo ──────────────── */}
        {viajeActivo && (
          <TouchableOpacity
            style={s.trackingPill}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: esConductor ? '/trip-in-progress' : '/trip-tracking',
                params: { viajeId: viajeActivo.id },
              })
            }
          >
            <View style={s.liveDot} />

            <Text style={s.trackingPillText} numberOfLines={1}>
              {esConductor
                ? compartiendoUbicacion
                  ? 'Compartiendo tu ubicación en vivo'
                  : 'Viaje en curso · conectando…'
                : vehiculoActivo
                ? `${viajeActivo.conductorNombre} va en camino · en vivo`
                : 'Tu conductor va en camino · conectando…'}
            </Text>

            <Text style={s.trackingPillArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── CONDUCTOR: finalizar viaje directamente desde home ───────── */}
        {esConductor && viajeActivo && (
          <TouchableOpacity
            style={[
              s.finalizarPill,
              finalizandoViaje && { opacity: 0.6 },
            ]}
            activeOpacity={0.85}
            disabled={finalizandoViaje}
            onPress={finalizarViajeDesdeHome}
          >
            {finalizandoViaje ? (
              <ActivityIndicator color="#0A0A0A" size="small" />
            ) : (
              <Text style={s.finalizarPillText}>🏁 Finalizar viaje</Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── TARJETA DE DISTANCIA / TIEMPO ──────────────────────────── */}
        {cargandoRuta && (
          <View style={s.routePill}>
            <ActivityIndicator
              color={C.accentGreen}
              size="small"
            />
          </View>
        )}

        {ruta && !cargandoRuta && (
          <View style={s.routePill}>
            <Text style={s.routePillIcon}>
              📍
            </Text>

            <Text style={s.routePillText}>
              {ruta.distanceText}
            </Text>

            <View style={s.routePillDivider} />

            <Text style={s.routePillIcon}>
              🕐
            </Text>

            <Text style={s.routePillText}>
              {ruta.durationText}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* ── PANEL INFERIOR ───────────────────────────────────────────── */}
      <View style={s.bottomSheet}>
        <View style={s.pill} />

        {/* ── CONDUCTOR: accesos rápidos para publicar un viaje ────────── */}
        {esConductor && (
          <>
            <Text style={s.question}>
              Where are you going to?
            </Text>

            {!!rutaError && (
              <Text style={s.errorText}>
                {rutaError}
              </Text>
            )}

            <View style={s.quickRow}>
              {[
                {
                  label: 'Casa',
                  icon: '🏠',
                },
                {
                  label: 'Universidad',
                  icon: '🎓',
                },
                {
                  label: 'Trabajo',
                  icon: '💼',
                },
              ].map(({ label, icon }) => (
                <TouchableOpacity
                  key={label}
                  style={s.quickChip}
                  onPress={() => {
                    if (label === 'Universidad') {
                      router.push({
                        pathname: '/publish-trip',
                        params: {
                          destinoDescripcion:
                            UNIVERSIDAD.descripcion,
                          destinoLat:
                            String(UNIVERSIDAD.lat),
                          destinoLng:
                            String(UNIVERSIDAD.lng),
                        },
                      });

                      return;
                    }

                    router.push({
                      pathname: '/publish-trip',
                      params: {
                        origenDescripcion:
                          UNIVERSIDAD.descripcion,
                        origenLat:
                          String(UNIVERSIDAD.lat),
                        origenLng:
                          String(UNIVERSIDAD.lng),
                        destinoDescripcion: label,
                      },
                    });
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={s.quickIcon}>
                    {icon}
                  </Text>

                  <Text style={s.quickLabel}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── PASAJERO: acceso directo a viajes disponibles ─────────────── */}
        {esPasajero && (
          <>
            <Text style={s.question}>
              Where are you going to?
            </Text>

            <TouchableOpacity
              style={s.buscarViajesBtn}
              onPress={() => router.push('/available-trips')}
              activeOpacity={0.8}
            >
              <Text style={s.buscarViajesIcon}>🔎</Text>
              <Text style={s.buscarViajesText}>Ver viajes disponibles</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── TAB BAR ────────────────────────────────────────────────── */}
        <View style={s.tabBar}>

          <TouchableOpacity
            style={s.tabItem}
            onPress={() =>
              handleTabPress('map')
            }
            activeOpacity={0.7}
          >
            <View style={s.mapIconWrap}>
              <View
                style={[
                  s.mapLine,
                  activeTab === 'map' &&
                    s.mapLineActive,
                ]}
              />

              <View
                style={[
                  s.mapLine,
                  {
                    width: 10,
                    marginLeft: 4,
                  },
                  activeTab === 'map' &&
                    s.mapLineActive,
                ]}
              />

              <View
                style={[
                  s.mapLine,
                  activeTab === 'map' &&
                    s.mapLineActive,
                ]}
              />
            </View>

            {activeTab === 'map' && (
              <View style={s.tabDot} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tabItem}
            onPress={() =>
              handleTabPress('locate')
            }
            activeOpacity={0.7}
          >
            <View
              style={[
                s.locateOuter,
                activeTab === 'locate' &&
                  s.locateOuterActive,
              ]}
            >
              <View
                style={[
                  s.locateInner,
                  activeTab === 'locate' &&
                    s.locateInnerActive,
                ]}
              />
            </View>

            {activeTab === 'locate' && (
              <View style={s.tabDot} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tabItem}
            onPress={() =>
              handleTabPress('profile')
            }
            activeOpacity={0.7}
          >
            <View style={s.personIconWrap}>
              <View
                style={[
                  s.personHead,
                  activeTab === 'profile' &&
                    s.personActive,
                ]}
              />

              <View
                style={[
                  s.personBody,
                  activeTab === 'profile' &&
                    s.personActive,
                ]}
              />
            </View>

            {activeTab === 'profile' && (
              <View style={s.tabDot} />
            )}
          </TouchableOpacity>

        </View>
      </View>

      {/* ── DETALLE DE VIAJE / RESERVA ──────────────────────────────── */}
      <Modal
        visible={!!viajeSeleccionado}
        transparent
        animationType="slide"
        onRequestClose={
          cerrarDetalleViaje
        }
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.pill} />

            {viajeSeleccionado && (
              <>
                <Text style={s.modalTitle}>
                  {viajeSeleccionado.conductorNombre}
                </Text>

                <Text style={s.modalSub}>
                  {viajeSeleccionado.vehiculoDescripcion}
                  {' · '}
                  {viajeSeleccionado.vehiculoPlaca}
                </Text>

                <View style={s.modalRow}>
                  <Text style={s.modalDot}>
                    🟢
                  </Text>

                  <Text style={s.modalRowText}>
                    {viajeSeleccionado.origenDescripcion}
                  </Text>
                </View>

                <View style={s.modalRow}>
                  <Text style={s.modalDot}>
                    🟣
                  </Text>

                  <Text style={s.modalRowText}>
                    {viajeSeleccionado.destinoDescripcion}
                  </Text>
                </View>

                <View style={s.modalStatsRow}>
                  <Text style={s.modalStat}>
                    {viajeSeleccionado.cuposDisponibles}/
                    {viajeSeleccionado.cuposTotales}{' '}
                    cupos
                  </Text>

                  <Text style={s.modalStat}>
                    ${viajeSeleccionado.aportePorPasajero}{' '}
                    p/p
                  </Text>
                </View>

                <Text style={s.modalFecha}>
                  🗓️{' '}
                  {new Date(
                    viajeSeleccionado.fechaHoraSalida
                  ).toLocaleString(
                    'es-CO',
                    {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }
                  )}
                </Text>

                {/* RESERVA SOLO PARA PASAJEROS */}
                {esPasajero &&
                viajeSeleccionado.conductorId !==
                  usuario?.id ? (
                  reservaOk ? (
                    <>
                      <Text
                        style={s.reservaOkText}
                      >
                        ✓ ¡Reserva creada con éxito!
                      </Text>

                      <TouchableOpacity
                        style={s.reservarBtn}
                        onPress={
                          cerrarDetalleViaje
                        }
                        activeOpacity={0.85}
                      >
                        <Text
                          style={
                            s.reservarBtnText
                          }
                        >
                          Cerrar
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TextInput
                        style={s.notasInput}
                        placeholder="Notas para el conductor (opcional)"
                        placeholderTextColor={
                          C.textMuted
                        }
                        value={notasReserva}
                        onChangeText={
                          setNotasReserva
                        }
                        multiline
                      />

                      <Text
                        style={
                          s.avisoCancelacion
                        }
                      >
                        ⓘ Podrás cancelar esta
                        reserva solo hasta 30
                        minutos antes de la salida.
                      </Text>

                      {!!reservaError && (
                        <Text
                          style={s.errorText}
                        >
                          {reservaError}
                        </Text>
                      )}

                      <TouchableOpacity
                        style={[
                          s.reservarBtn,
                          reservando && {
                            opacity: 0.6,
                          },
                        ]}
                        onPress={
                          confirmarReserva
                        }
                        disabled={reservando}
                        activeOpacity={0.85}
                      >
                        {reservando ? (
                          <ActivityIndicator
                            color="#0A0A0A"
                          />
                        ) : (
                          <Text
                            style={
                              s.reservarBtnText
                            }
                          >
                            Reservar cupo
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )
                ) : (
                  <Text
                    style={
                      s.soloPasajerosText
                    }
                  >
                    {viajeSeleccionado.conductorId ===
                    usuario?.id
                      ? 'Este es tu viaje publicado.'
                      : 'Solo los pasajeros pueden reservar cupos en un viaje.'}
                  </Text>
                )}

                <Pressable
                  onPress={
                    cerrarDetalleViaje
                  }
                  hitSlop={8}
                  style={{
                    alignSelf: 'center',
                    marginTop: 12,
                  }}
                >
                  <Text style={s.clearIcon}>
                    Cerrar
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },

  safeHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginHorizontal: 16,
    gap: 12,
  },

  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E343C',
    borderWidth: 2,
    borderColor: C.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },

  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: C.accentGreen,
  },

  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(19,21,23,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: C.text,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 4,
  },

  greetingName: {
    fontWeight: '700',
  },

  trackingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(19,21,23,0.9)',
    borderWidth: 1,
    borderColor: C.accentGreen,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '86%',
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accentGreen,
  },

  trackingPillText: {
    color: C.text,
    fontWeight: '700',
    fontSize: 12.5,
    flexShrink: 1,
  },

  trackingPillArrow: {
    color: C.accentGreen,
    fontWeight: '700',
    fontSize: 16,
  },

  finalizarPill: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: '#F5821F',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },

  finalizarPillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
  },

  carMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(19,21,23,0.85)',
    borderWidth: 1,
    borderColor: C.accentGreen,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  routePillIcon: {
    fontSize: 13,
  },

  routePillText: {
    color: C.accentGreen,
    fontWeight: '700',
    fontSize: 13,
  },

  routePillDivider: {
    width: 1,
    height: 12,
    backgroundColor: C.accentGreen,
    opacity: 0.4,
    marginHorizontal: 2,
  },

  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 16,
  },

  pill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 18,
  },

  question: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 14,
    letterSpacing: -0.3,
  },

  errorText: {
    color: '#E05C5C',
    fontSize: 12,
    marginBottom: 8,
  },

  clearIcon: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '600',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  modalCard: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },

  modalTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
  },

  modalSub: {
    color: C.textMuted,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },

  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  modalDot: {
    fontSize: 12,
  },

  modalRowText: {
    color: C.text,
    fontSize: 14,
    flexShrink: 1,
  },

  modalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },

  modalStat: {
    color: C.accentGreen,
    fontWeight: '700',
    fontSize: 14,
  },

  modalFecha: {
    color: C.textMuted,
    fontSize: 13,
    marginBottom: 14,
  },

  avisoCancelacion: {
    color: C.textMuted,
    fontSize: 12,
    marginBottom: 10,
    fontStyle: 'italic',
  },

  notasInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    color: C.text,
    padding: 12,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 10,
  },

  reservarBtn: {
    backgroundColor: C.accentGreen,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },

  reservarBtnText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 15,
  },

  reservaOkText: {
    color: C.accentGreen,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 14,
  },

  soloPasajerosText: {
    color: C.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },

  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },

  quickChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
  },

  quickIcon: {
    fontSize: 14,
  },

  quickLabel: {
    fontSize: 13,
    color: C.iconMuted,
    fontWeight: '500',
  },

  buscarViajesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accentGreen,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
    marginBottom: 20,
  },

  buscarViajesIcon: {
    fontSize: 16,
  },

  buscarViajesText: {
    fontSize: 15,
    color: '#0A0A0A',
    fontWeight: '700',
  },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    paddingBottom: 4,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },

  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.accentGreen,
  },

  mapIconWrap: {
    gap: 3,
    alignItems: 'flex-start',
  },

  mapLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.iconMuted,
  },

  mapLineActive: {
    backgroundColor: C.accentGreen,
  },

  locateOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.iconMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locateOuterActive: {
    borderColor: C.accentGreen,
  },

  locateInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.iconMuted,
  },

  locateInnerActive: {
    backgroundColor: C.accentGreen,
  },

  personIconWrap: {
    alignItems: 'center',
    gap: 2,
  },

  personHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.iconMuted,
  },

  personBody: {
    width: 16,
    height: 8,
    borderRadius: 8,
    backgroundColor: C.iconMuted,
  },

  personActive: {
    backgroundColor: C.accentGreen,
  },
});