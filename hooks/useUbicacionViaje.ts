import {
  abrirTracking,
  enviarUbicacion,
  enviarUbicacionPasajero,
  obtenerUbicacion,
  suscribirseAPasajeros,
  suscribirseAUbicacion,
  UbicacionEvento,
} from '@/services/tracking';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export interface Posicion {
  lat: number;
  lng: number;
  actualizadaEn: string | null;
  usuarioId?: string;
  nombre?: string;
}

interface Opciones {
  viajeId?: string;
  /** Rol de quien usa el hook en este viaje. */
  rol: 'CONDUCTOR' | 'PASAJERO';
  /** Estado conocido del viaje (por REST) hasta que llegue uno por WebSocket. */
  estadoInicial?: string;
  /** Si es true, comparte mi GPS mientras el viaje esté EN_CURSO. */
  compartir?: boolean;
}

const HEARTBEAT_MS = 5000;     // re-publica aunque estés quieto
const SIN_SENAL_MS = 8000;     // sin eventos WS => consulta por REST
const POLL_MS = 6000;

/**
 * Seguimiento en vivo bidireccional de un viaje.
 *  - Conductor y pasajero comparten su GPS mientras el viaje está EN_CURSO.
 *  - El pasajero ve la posición del conductor; el conductor ve la de cada pasajero.
 *  - Usa una única conexión STOMP compartida y, como respaldo, consulta la
 *    última posición del conductor por REST si el WebSocket no entrega nada.
 */
export function useUbicacionViaje({ viajeId, rol, estadoInicial, compartir = true }: Opciones) {
  const [conductor, setConductor] = useState<Posicion | null>(null);
  const [pasajeros, setPasajeros] = useState<Record<string, Posicion>>({});
  const [estadoWs, setEstadoWs]   = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);
  const [gpsActivo, setGpsActivo] = useState(false);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const [miPosicion, setMiPosicion] = useState<Posicion | null>(null);

  const ultimaRecepcion = useRef(Date.now());
  const estadoActual = estadoWs ?? estadoInicial ?? 'PROGRAMADO';

  const aplicarEvento = (e: UbicacionEvento) => {
    ultimaRecepcion.current = Date.now();
    if (e.estado) setEstadoWs(e.estado);
    if (e.lat == null || e.lng == null) return;

    const pos: Posicion = {
      lat: e.lat, lng: e.lng, actualizadaEn: e.actualizadaEn,
      usuarioId: e.usuarioId, nombre: e.nombre,
    };
    if (e.rol === 'PASAJERO') {
      if (rol === 'CONDUCTOR') {
        setPasajeros((prev) => ({ ...prev, [e.usuarioId ?? 'pasajero']: pos }));
      }
    } else {
      setConductor(pos);
    }
  };

  // Al cambiar de viaje, se descarta lo del anterior.
  useEffect(() => {
    setConductor(null);
    setPasajeros({});
    setEstadoWs(null);
    setMiPosicion(null);
    ultimaRecepcion.current = Date.now();
  }, [viajeId]);

  // ── 1) Conexión + suscripciones ─────────────────────────────────────
  useEffect(() => {
    if (!viajeId || Platform.OS === 'web') return;

    let activo = true;
    let quitar: Array<() => void> = [];
    const limpiarSubs = () => { quitar.forEach((q) => q()); quitar = []; };
    let liberar: (() => void) | null = null;

    abrirTracking({
      onConnect: () => {
        if (!activo) return;
        limpiarSubs(); // en reconexión las anteriores ya no sirven
        quitar.push(suscribirseAUbicacion(viajeId, aplicarEvento));
        if (rol === 'CONDUCTOR') quitar.push(suscribirseAPasajeros(aplicarEvento));
        setConectado(true);
      },
      onDisconnect: () => { if (activo) setConectado(false); },
    }).then((l) => {
      if (!activo) l(); else liberar = l;
    });

    return () => {
      activo = false;
      limpiarSubs();
      liberar?.();
      setConectado(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viajeId, rol]);

  // ── 2) Posición inicial + respaldo por REST (conductor visto por pasajero) ──
  useEffect(() => {
    if (!viajeId) return;
    let activo = true;

    const consultar = async () => {
      try {
        const u = await obtenerUbicacion(viajeId);
        if (!activo) return;
        if (u.estado) setEstadoWs(u.estado);
        if (u.lat != null && u.lng != null) {
          setConductor({ lat: u.lat, lng: u.lng, actualizadaEn: u.actualizadaEn });
        }
      } catch { /* sin respaldo disponible */ }
    };

    consultar();
    if (rol !== 'PASAJERO') return () => { activo = false; };

    const id = setInterval(() => {
      const terminado = estadoActual === 'COMPLETADO' || estadoActual === 'CANCELADO';
      if (terminado) return;
      if (Date.now() - ultimaRecepcion.current > SIN_SENAL_MS) consultar();
    }, POLL_MS);

    return () => { activo = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viajeId, rol, estadoActual === 'COMPLETADO' || estadoActual === 'CANCELADO']);

  // ── 3) Compartir mi GPS mientras el viaje está EN_CURSO ──────────────
  const debeCompartir = compartir && estadoActual === 'EN_CURSO';

  useEffect(() => {
    // El GPS propio se activa apenas el viaje está EN_CURSO, sin esperar al
    // WebSocket: así la cámara sigue mi ubicación desde el primer momento.
    // Publicar solo llega al servidor cuando hay conexión (si no, se omite).
    if (Platform.OS === 'web' || !viajeId || !debeCompartir) {
      setGpsActivo(false);
      return;
    }

    let activo = true;
    let watcher: Location.LocationSubscription | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ultima: { lat: number; lng: number } | null = null;
    let ultimoEnvio = 0;
    const enviar = rol === 'CONDUCTOR' ? enviarUbicacion : enviarUbicacionPasajero;

    const publicar = (lat: number, lng: number) => {
      ultima = { lat, lng };
      ultimoEnvio = Date.now();
      enviar(viajeId, lat, lng);
      setMiPosicion({ lat, lng, actualizadaEn: new Date().toISOString() });
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!activo) return;
      if (status !== 'granted') {
        setPermisoDenegado(true);
        return;
      }
      setPermisoDenegado(false);
      setGpsActivo(true);

      // Posición inmediata: sin esperar a que el usuario se mueva.
      try {
        const actual = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (activo) publicar(actual.coords.latitude, actual.coords.longitude);
      } catch { /* el watcher de abajo lo intenta de nuevo */ }

      if (!activo) return;
      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 0 },
        (pos) => publicar(pos.coords.latitude, pos.coords.longitude),
      );
      if (!activo) { watcher.remove(); watcher = null; return; }

      // Latido: si el GPS no emite (estás quieto), re-publica la última posición
      // para que quien se conecte tarde la reciba igual.
      heartbeat = setInterval(() => {
        if (ultima && Date.now() - ultimoEnvio >= HEARTBEAT_MS - 500) {
          publicar(ultima.lat, ultima.lng);
        }
      }, HEARTBEAT_MS);
    })();

    return () => {
      activo = false;
      watcher?.remove();
      if (heartbeat) clearInterval(heartbeat);
      setGpsActivo(false);
    };
  }, [viajeId, rol, debeCompartir]);

  return {
    conductor,
    pasajeros,
    miPosicion,
    estado: estadoActual,
    conectado,
    compartiendo: gpsActivo && conectado,
    permisoDenegado,
  };
}
