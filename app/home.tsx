import { useAppTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { CalificarModal } from '@/components/CalificarModal';
import { CalificacionPendiente, obtenerPendientes } from '@/services/calificaciones';
import { getRoute, LatLng, RouteInfo } from '@/services/directions';
import { PlaceLatLng } from '@/services/places';
import { misReservas, reservasDeViaje, solicitarReserva } from '@/services/reservas';
import BadgeContador from '@/components/BadgeContador';
import { useContadores } from '@/hooks/useContadores';
import { useUbicacionViaje } from '@/hooks/useUbicacionViaje';
import { Viaje } from '@/services/types';
import {
  completarViaje,
  detalleViaje,
  listarMisViajes,
  listarViajes,
} from '@/services/viajes';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from "expo-router/react-navigation";
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const DARK_C = {
  bg:          '#131517',
  surface:     '#1E2126',
  border:      '#2E343C',
  text:        '#FFFFFF',
  textMuted:   '#6B7785',
  textSub:     '#9BA3AD',
  accentGreen: '#3DBE7A',
  accent:      '#4A90D9',
  iconMuted:   '#4A5160',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  surface: '#FFFFFF',
  border: '#DDE1E6',
  text: '#11181C',
  textMuted: '#7A8593',
  textSub: '#5B6472',
  accentGreen: '#3DBE7A',
  accent: '#4A90D9',
  iconMuted: '#9099A6',
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
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);

  if (Platform.OS === 'web') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#1c1c1c' : '#F5F7F8' }]} />;
  }

  const MapView = require('react-native-maps').default;
  const { Polyline, Marker, Callout, PROVIDER_DEFAULT, PROVIDER_GOOGLE } = require('react-native-maps');
  const mapProvider = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={mapProvider}
      customMapStyle={isDark ? DARK_MAP_STYLE : []}
      // Apple Maps (iOS) ignora customMapStyle y sigue el tema del sistema:
      // se fuerza al tema de la app para que no salga oscuro en modo claro.
      userInterfaceStyle={isDark ? 'dark' : 'light'}
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

type CalificacionEnriquecida = {
  reservaId: string;
  viajeId: string;
  nombre: string;
  rol: 'CONDUCTOR' | 'PASAJERO';
};

/**
 * Completa nombre y rol de a quién se califica usando las reservas:
 * - Conductor (puede listar las reservas de su viaje): ve a TODOS los pasajeros que abordaron.
 * - Pasajero: ve al conductor de su reserva.
 */
async function enriquecerPendientes(pendientes: CalificacionPendiente[]): Promise<CalificacionEnriquecida[]> {
  if (pendientes.length === 0) return [];
  const salida: CalificacionEnriquecida[] = [];
  const viajeIds = Array.from(new Set(pendientes.map((p) => p.viajeId)));
  let mias: Awaited<ReturnType<typeof misReservas>> = [];
  try { mias = await misReservas(); } catch {}

  for (const viajeId of viajeIds) {
    const delViaje = pendientes.filter((p) => p.viajeId === viajeId);
    let reservasViaje: Awaited<ReturnType<typeof reservasDeViaje>> | null = null;
    try { reservasViaje = await reservasDeViaje(viajeId); } catch { reservasViaje = null; }

    if (reservasViaje) {
      // Soy el conductor de este viaje: todos los pasajeros que viajaron.
      const idsPendientes = new Set(delViaje.map((p) => p.reservaId));
      const lista = reservasViaje.filter(
        (r) => idsPendientes.has(r.id) || (r.abordo === true && ['COMPLETADA', 'CONFIRMADA'].includes(r.estado)),
      );
      lista.forEach((r) => salida.push({ reservaId: r.id, viajeId, nombre: r.pasajeroNombre || 'Pasajero', rol: 'PASAJERO' }));
    } else {
      // Soy pasajero: califico al conductor.
      delViaje.forEach((p) => {
        const r = mias.find((m) => m.id === p.reservaId);
        const nombre = r?.conductorNombre || (p as any).aCalificarNombre || 'Conductor';
        salida.push({ reservaId: p.reservaId, viajeId, nombre, rol: 'CONDUCTOR' });
      });
    }
  }
  return salida;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const { usuario } = useAuth();
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

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

  const [finalizandoViaje, setFinalizandoViaje] =
    useState(false);

  const centradoInicialHecho = useRef(false);

  // ── ROLES ───────────────────────────────────────────────────────────
  // Ahora el rol real del usuario determina qué funcionalidades puede ver.
  const esConductor = usuario?.rol === 'CONDUCTOR';
  const esPasajero = usuario?.rol === 'PASAJERO';

  // Contadores de los íconos (chat y notificaciones) y badge del ícono de la app.
  const { chats: chatsSinLeer, notificaciones: notifSinVer, refrescar: refrescarContadores } =
    useContadores(esConductor, !!usuario && (esConductor || esPasajero));

  // Contador del ícono de reservas (solo pasajero): reservas pendientes de
  // respuesta + confirmadas. Se refresca al volver a la pantalla y cada 15 s.
  const [reservasActivas, setReservasActivas] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!esPasajero) {
        setReservasActivas(0);
        return;
      }
      let cancelado = false;
      const cargarReservas = async () => {
        try {
          const reservas = await misReservas();
          if (!cancelado) {
            setReservasActivas(
              reservas.filter((r) => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado)).length
            );
          }
        } catch {
          // Silencioso: se conserva el último valor
        }
      };
      cargarReservas();
      const id = setInterval(cargarReservas, 15000);
      return () => {
        cancelado = true;
        clearInterval(id);
      };
    }, [esPasajero])
  );

  // Seguimiento en vivo del viaje EN_CURSO (bidireccional). Solo comparto mi
  // GPS desde home cuando está en primer plano, para no duplicar con las
  // pantallas de seguimiento (trip-tracking / trip-in-progress) que se abren encima.
  const [homeEnFoco, setHomeEnFoco] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setHomeEnFoco(true);
      refrescarContadores();
      return () => setHomeEnFoco(false);
    }, [refrescarContadores])
  );

  const {
    conductor: posConductor,
    miPosicion,
    estado: estadoLive,
    compartiendo: compartiendoUbicacion,
  } = useUbicacionViaje({
    viajeId: viajeActivo?.id,
    rol: esConductor ? 'CONDUCTOR' : 'PASAJERO',
    estadoInicial: viajeActivo?.estado,
    compartir: homeEnFoco,
  });

  // Posición que se pinta en el mapa: el conductor ve su propio vehículo;
  // el pasajero ve al conductor.
  useEffect(() => {
    const p = esConductor ? miPosicion ?? posConductor : posConductor;
    if (p) setVehiculoActivo({ latitude: p.lat, longitude: p.lng });
  }, [esConductor, miPosicion?.lat, miPosicion?.lng, posConductor?.lat, posConductor?.lng]);

  // Si el conductor finaliza o cancela, se retira el viaje del mapa.
  useEffect(() => {
    if (viajeActivo && estadoLive && estadoLive !== 'EN_CURSO' && estadoLive !== 'PROGRAMADO') {
      setViajeActivo(null);
      setVehiculoActivo(null);
      setRutaActivaCoords([]);
    }
  }, [estadoLive]);

  const nombreMostrado = usuario?.nombre ?? 'Usuario';

  // Cola de viajes completados donde falta calificar a la contraparte.
  // Se revisa cada vez que la pantalla vuelve a tomar foco (p. ej. justo
  // después de finalizar un viaje), y se muestra el modal de a uno.
  const [colaCalificaciones, setColaCalificaciones] = useState<CalificacionEnriquecida[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      (async () => {
        try {
          const pendientes = await obtenerPendientes();
          const enriquecidas = await enriquecerPendientes(pendientes);
          if (!cancelado) setColaCalificaciones(enriquecidas);
        } catch {
          // Silencioso: no bloquea el resto de la pantalla si falla.
        }
      })();
      return () => {
        cancelado = true;
      };
    }, [])
  );

  // Se agrupa por viaje: el pasajero ve al conductor; el conductor ve a todos
  // los pasajeros del mismo viaje en un solo modal.
  const calificacionActual = colaCalificaciones[0] ?? null;
  const personasACalificar = calificacionActual
    ? colaCalificaciones
        .filter((c) => c.viajeId === calificacionActual.viajeId)
        .map((c) => ({ reservaId: c.reservaId, nombre: c.nombre, rol: c.rol }))
    : [];

  const handleCalificacionHecha = () => {
    if (!calificacionActual) return;
    setColaCalificaciones((prev) => prev.filter((c) => c.viajeId !== calificacionActual.viajeId));
  };

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

          // OJO: no se llama setViajesPublicados(conCoords) aquí todavía.
          // Antes se pintaban los marcadores sin ruta y luego, al terminar
          // de calcular las rutas, se volvían a pintar con la polilínea —
          // ese doble render hacía que las líneas de ruta parpadearan
          // (desaparecían y volvían a aparecer) cada vez que la pantalla
          // recuperaba el foco, por ejemplo al volver de "Mis viajes". Se
          // actualiza una sola vez, ya con todo listo, más abajo.

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

      const detectar = async () => {
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

          setViajeActivo((prev) =>
            prev?.id === activo?.id && prev?.estado === activo?.estado ? prev : activo
          );

          if (
            activo?.ubicacionLat != null &&
            activo?.ubicacionLng != null
          ) {
            // Solo como posición inicial: no pisa la posición en vivo.
            setVehiculoActivo((prev) => prev ?? {
              latitude: activo!.ubicacionLat!,
              longitude: activo!.ubicacionLng!,
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
      };

      detectar();
      // Revisa cada 10 s: así, si el conductor inicia el viaje mientras el
      // pasajero ya está en home, el seguimiento arranca solo.
      const id = setInterval(detectar, 10000);

      return () => {
        cancelado = true;
        clearInterval(id);
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

        // Centra el mapa en la ubicación actual (a menos que ya se haya
        // centrado en el vehículo de un viaje en curso).
        const centrarMapa = (lat: number, lng: number) => {
          if (centradoInicialHecho.current) return;
          const animar = () =>
            mapRef.current?.animateToRegion(
              { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
              600
            );
          animar();
          // Reintento por si el mapa aún no terminaba de cargar.
          setTimeout(animar, 700);
        };

        // Posición rápida (caché) para que el mapa no se quede en Bogotá
        // mientras el GPS obtiene la posición exacta.
        const ultima = await Location.getLastKnownPositionAsync().catch(() => null);
        if (ultima) centrarMapa(ultima.coords.latitude, ultima.coords.longitude);

        const pos =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

        setOrigenLL({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        centrarMapa(pos.coords.latitude, pos.coords.longitude);
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
      t('home.alertFinalizarTitle'),
      t('home.alertFinalizarMessage'),
      [
        { text: t('home.alertCancelar'), style: 'cancel' },
        {
          text: t('home.alertFinalizarConfirm'),
          onPress: async () => {
            setFinalizandoViaje(true);
            try {
              await completarViaje(viajeActivo.id);
              setViajeActivo(null);
              setVehiculoActivo(null);
              setRutaActivaCoords([]);
            } catch (e: any) {
              Alert.alert(
                t('home.alertNoSePudoTitle'),
                e?.message ?? t('home.alertIntentaDeNuevo')
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
            {t('home.greeting')}
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
            <BadgeContador n={chatsSinLeer} />
          </TouchableOpacity>

          {/* NOTIFICACIONES - CONDUCTOR (solicitudes) Y PASAJERO (viaje finalizado/cancelado) */}
          {(esConductor || esPasajero) && (
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
              <BadgeContador n={notifSinVer} />
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
              <BadgeContador n={reservasActivas} />
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
                  ? t('home.trackingCompartiendo')
                  : t('home.trackingConectandoConductor')
                : vehiculoActivo
                ? t('home.trackingEnVivo', { nombre: viajeActivo.conductorNombre })
                : t('home.trackingConectandoPasajero')}
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
              <Text style={s.finalizarPillText}>{t('home.finalizarViaje')}</Text>
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
      <View style={[s.bottomSheet, { paddingBottom: 12 + insets.bottom }]}>
        <View style={s.pill} />

        {/* ── CONDUCTOR: accesos rápidos para publicar un viaje ────────── */}
        {esConductor && (
          <>
            <Text style={s.question}>
              {t('home.whereGoing')}
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
                  icon: 'home-outline' as const,
                },
                {
                  label: 'Universidad',
                  icon: 'school-outline' as const,
                },
                {
                  label: 'Trabajo',
                  icon: 'briefcase-outline' as const,
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
                      },
                    });
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name={icon} size={20} color={C.accentGreen} />

                  <Text style={s.quickLabel}>
                    {label === 'Casa' ? t('home.quickCasa') : label === 'Universidad' ? t('home.quickUniversidad') : t('home.quickTrabajo')}
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
              {t('home.whereGoing')}
            </Text>

            <TouchableOpacity
              style={s.buscarViajesBtn}
              onPress={() => router.push('/available-trips')}
              activeOpacity={0.8}
            >
              {/* Mismo color que el texto del botón (antes era un emoji 🔎) */}
              <Ionicons name="search" size={18} color="#0A0A0A" />
              <Text style={s.buscarViajesText}>{t('home.verViajesDisponibles')}</Text>
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
                    {t('home.cupos')}
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
                        {t('home.reservaExito')}
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
                          {t('home.cerrar')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TextInput
                        style={s.notasInput}
                        placeholder={t('home.notasPlaceholder')}
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
                        {t('home.avisoCancelacion')}
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
                            {t('home.reservarCupo')}
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
                      ? t('home.esTuViaje')
                      : t('home.soloPasajeros')}
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
                    {t('home.cerrar')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {calificacionActual && (
        <CalificarModal
          key={calificacionActual.viajeId}
          visible
          personas={personasACalificar}
          onDone={handleCalificacionHecha}
        />
      )}
    </View>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
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
    backgroundColor: C.surface,
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

  // Fondo y texto salen del tema: antes el fondo era oscuro fijo y en modo
  // claro el texto (casi negro) no se leía.
  trackingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.accentGreen,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '86%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
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
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.accentGreen,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
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
    color: C.textSub,
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
    color: C.textSub,
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
    color: C.textSub,
    fontSize: 13,
    marginBottom: 14,
  },

  avisoCancelacion: {
    color: C.textSub,
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
    color: C.textSub,
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
}