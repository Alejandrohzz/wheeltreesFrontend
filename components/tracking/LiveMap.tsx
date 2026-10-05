import { LatLng } from '@/services/directions';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { MAP_DARK, MAP_LIGHT, TrackColors } from './theme';
import { usePosicionSuave } from './hooks';

export interface PasajeroMapa {
  id: string;
  latitude: number;
  longitude: number;
  nombre?: string;
}

interface Props {
  mapRef: React.RefObject<any>;
  isDark: boolean;
  C: TrackColors;
  origen: LatLng | null;
  destino: LatLng | null;
  /** Posición del conductor (se anima suavemente). */
  conductor: LatLng | null;
  heading: number;
  rutaRecorrida: LatLng[];
  rutaRestante: LatLng[];
  /** Tramo conductor → punto de encuentro (línea negra gruesa, como "va por ti"). */
  rutaAproximacion?: LatLng[];
  /** "7 min" mostrado en la etiqueta del destino. */
  etaDestino?: string | null;
  /** "3 min" mostrado en la etiqueta del punto de encuentro. */
  etaOrigen?: string | null;
  textoOrigen: string;
  textoDestino: string;
  pasajeros?: PasajeroMapa[];
  /** Punto azul nativo de "mi ubicación" (vista del pasajero). */
  mostrarMiUbicacion?: boolean;
  /** Espacio ocupado arriba/abajo por la barra y el sheet. */
  padding: { top: number; bottom: number };
  onPanDrag?: () => void;
}

/** Evita que Android deje la etiqueta en blanco: renderiza al bitmap y luego congela. */
function useCongelarVista(...deps: unknown[]) {
  const [seguir, setSeguir] = useState(true);
  useEffect(() => {
    setSeguir(true);
    const id = setTimeout(() => setSeguir(false), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return seguir;
}

export default function LiveMap(p: Props) {
  const { C, isDark } = p;
  const s = useMemo(() => estilos(C), [C]);
  const posAuto = usePosicionSuave(p.conductor);
  const seguirEtiquetaDestino = useCongelarVista(p.etaDestino, p.textoDestino, isDark);
  const seguirEtiquetaOrigen  = useCongelarVista(p.etaOrigen, p.textoOrigen, isDark);
  const seguirPuntos          = useCongelarVista(isDark);

  if (Platform.OS === 'web') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#1c1c1c' : '#EDEDED' }]} />;
  }

  const MapView = require('react-native-maps').default;
  const { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } = require('react-native-maps');
  const provider = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;
  const centro = p.origen ?? p.destino ?? { latitude: 4.711, longitude: -74.0721 };

  return (
    <MapView
      ref={p.mapRef}
      style={StyleSheet.absoluteFill}
      provider={provider}
      customMapStyle={isDark ? MAP_DARK : MAP_LIGHT}
      userInterfaceStyle={isDark ? 'dark' : 'light'}
      initialRegion={{ ...centro, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      mapPadding={{ top: p.padding.top, bottom: p.padding.bottom, left: 0, right: 0 }}
      showsUserLocation={!!p.mostrarMiUbicacion}
      showsMyLocationButton={false}
      showsCompass={false}
      showsTraffic={false}
      toolbarEnabled={false}
      onPanDrag={p.onPanDrag}
    >
      {/* Ruta: lo recorrido en gris, lo que falta en verde */}
      {p.rutaRecorrida.length > 1 && (
        <Polyline coordinates={p.rutaRecorrida} strokeColor={C.routeDone} strokeWidth={5} lineCap="round" />
      )}
      {p.rutaRestante.length > 1 && (
        <Polyline
          coordinates={p.rutaRestante}
          strokeColor={p.rutaAproximacion && p.rutaAproximacion.length > 1 ? C.routeDone : C.route}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {p.rutaAproximacion && p.rutaAproximacion.length > 1 && (
        <Polyline coordinates={p.rutaAproximacion} strokeColor={C.route} strokeWidth={5} lineCap="round" lineJoin="round" />
      )}

      {/* Origen / punto de encuentro: pin morado */}
      {p.origen && (
        <Marker
          coordinate={p.origen}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={seguirEtiquetaOrigen}
        >
          <View style={s.etiquetaWrap}>
            <View style={s.etiqueta}>
              <Text style={s.etiquetaTitulo}>{p.textoOrigen}</Text>
              {!!p.etaOrigen && <Text style={s.etiquetaEta}>{p.etaOrigen}</Text>}
            </View>
            <View style={s.pinOrigen}><Ionicons name="person" size={14} color="#FFFFFF" /></View>
          </View>
        </Marker>
      )}

      {/* Destino: pin verde con etiqueta + minutos */}
      {p.destino && (
        <Marker
          coordinate={p.destino}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={seguirEtiquetaDestino}
        >
          <View style={s.etiquetaWrap}>
            <View style={s.etiqueta}>
              <Text style={s.etiquetaTitulo}>{p.textoDestino}</Text>
              {!!p.etaDestino && <Text style={s.etiquetaEta}>{p.etaDestino}</Text>}
            </View>
            <View style={s.pinDestino}><Ionicons name="flag" size={14} color="#FFFFFF" /></View>
          </View>
        </Marker>
      )}

      {/* Pasajeros (solo los ve el conductor) */}
      {(p.pasajeros ?? []).map((ps) => (
        <Marker
          key={ps.id}
          coordinate={{ latitude: ps.latitude, longitude: ps.longitude }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={seguirPuntos}
          title={ps.nombre}
        >
          <View style={s.pasajero}>
            <Text style={s.pasajeroTxt}>{(ps.nombre ?? '?').trim().charAt(0).toUpperCase()}</Text>
          </View>
        </Marker>
      ))}

      {/* Vehículo: flecha que rota según el rumbo */}
      {posAuto && (
        <Marker
          coordinate={posAuto}
          anchor={{ x: 0.5, y: 0.5 }}
          rotation={p.heading}
          flat
          zIndex={10}
          tracksViewChanges={seguirPuntos}
        >
          <View style={s.auto}>
            <MaterialCommunityIcons name="navigation" size={22} color={C.accent} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

function estilos(C: TrackColors) {
  const sombra = {
    elevation: 5,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  } as const;
  return StyleSheet.create({
    etiquetaWrap: { alignItems: 'center' },
    etiqueta: {
      backgroundColor: C.sheet,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 6,
      minWidth: 64,
      alignItems: 'flex-start',
      borderWidth: 1,
      borderColor: C.border,
      ...sombra,
    },
    etiquetaTitulo: { fontSize: 11, color: C.textSub, fontWeight: '600' },
    etiquetaEta:    { fontSize: 15, color: C.green, fontWeight: '800', marginTop: 1 },

    pinOrigen: {
      width: 30, height: 30, borderRadius: 15, backgroundColor: C.origin,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2.5, borderColor: C.sheet,
      ...sombra,
    },
    pinDestino: {
      width: 30, height: 30, borderRadius: 15, backgroundColor: C.green,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2.5, borderColor: C.sheet,
      ...sombra,
    },

    // Vehículo: mismo estilo que el marcador de conductor de la app
    auto: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.sheet,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2.5, borderColor: C.accent,
      ...sombra,
    },

    pasajero: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: C.accent, borderWidth: 2, borderColor: C.sheet,
      alignItems: 'center', justifyContent: 'center',
    },
    pasajeroTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  });
}
