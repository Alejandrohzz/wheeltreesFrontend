import { Client, IMessage } from '@stomp/stompjs';
import { apiFetch, BASE_URL, getToken } from './api';

/**
 * Evento de ubicación/estado de un viaje.
 *
 *  - Posiciones del conductor: llegan por /topic/viaje.{id}.ubicacion a todos
 *    los participantes (rol ausente o 'CONDUCTOR').
 *  - Posiciones de pasajeros: llegan SOLO al conductor, por la cola privada
 *    /user/queue/ubicaciones-pasajeros (rol 'PASAJERO'), para que un pasajero
 *    no vea dónde están los demás.
 *  - Avisos de cambio de estado (iniciar/completar/cancelar): lat/lng nulos.
 */
export interface UbicacionEvento {
  viajeId:        string;
  estado:         string; // PROGRAMADO | EN_CURSO | COMPLETADO | CANCELADO
  lat:            number | null;
  lng:            number | null;
  actualizadaEn:  string | null; // ISO 8601
  rol?:           'CONDUCTOR' | 'PASAJERO';
  usuarioId?:     string;
  nombre?:        string;
}

/** GET /api/viajes/{id}/ubicacion — última posición conocida del conductor (carga inicial / respaldo) */
export const obtenerUbicacion = (viajeId: string) =>
  apiFetch<UbicacionEvento>(`/api/viajes/${viajeId}/ubicacion`);

// ─────────────────────────────────────────────────────────────────────────
// Cliente WebSocket/STOMP compartido (independiente del de chat.ts).
//
// Varias pantallas pueden usar el seguimiento a la vez (home, seguimiento del
// pasajero, viaje en curso del conductor). Antes cada una cerraba la conexión
// de la otra al montarse/desmontarse; ahora es una única conexión con conteo
// de usuarios: se abre con el primero y se cierra cuando sale el último.
// ─────────────────────────────────────────────────────────────────────────

export interface ManejadoresTracking {
  onConnect: () => void;
  onDisconnect?: () => void;
  onError?: (err: string) => void;
}

function wsUrl(token: string): string {
  const base = BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}

let client: Client | null = null;
const manejadores = new Set<ManejadoresTracking>();

/**
 * Registra un consumidor del seguimiento y abre la conexión si hace falta.
 * Devuelve la función que lo libera (llámala en el cleanup del efecto).
 * onConnect se dispara en la primera conexión y en cada reconexión: ahí hay
 * que (re)suscribirse, porque STOMP pierde las suscripciones al caerse.
 */
export async function abrirTracking(h: ManejadoresTracking): Promise<() => void> {
  manejadores.add(h);
  const liberar = () => {
    manejadores.delete(h);
    if (manejadores.size === 0 && client) {
      client.deactivate();
      client = null;
    }
  };

  if (!client) {
    const token = await getToken();
    if (!manejadores.has(h)) return () => {}; // se liberó mientras esperábamos el token
    if (!token) {
      h.onError?.('No hay sesión activa');
      return liberar;
    }

    if (!client) {
      const url = wsUrl(token);
      if (__DEV__) console.log('🔌 Conectando tracking a', url);

      client = new Client({
        brokerURL: url,
        // React Native: sin esto los frames STOMP llegan truncados/sin el
        // byte NULL final y la conexión se queda en "conectando…".
        forceBinaryWSFrames: true,
        appendMissingNULLonIncoming: true,
        reconnectDelay: 3000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: (msg) => { if (__DEV__) console.log('[STOMP-tracking]', msg); },
        onConnect: () => {
          if (__DEV__) console.log('🔌 Tracking conectado');
          manejadores.forEach((m) => m.onConnect());
        },
        onStompError: (frame) => {
          console.log('🔌 STOMP error (tracking):', frame.headers['message'], frame.body);
          manejadores.forEach((m) => m.onError?.(frame.headers['message'] ?? 'Error de conexión'));
        },
        onWebSocketError: (event) => {
          console.log('🔌 WebSocket error crudo (tracking):', JSON.stringify(event));
          manejadores.forEach((m) => m.onError?.('No se pudo conectar al seguimiento en tiempo real'));
        },
        onWebSocketClose: (event) => {
          console.log('🔌 WebSocket de tracking cerrado. Código:', event?.code, 'Razón:', event?.reason);
          manejadores.forEach((m) => m.onDisconnect?.());
        },
      });
      client.activate();
    }
  } else if (client.connected) {
    // La conexión ya estaba abierta (la abrió otra pantalla): suscribe ya.
    h.onConnect();
  }

  return liberar;
}

function suscribir(destino: string, onMsg: (frame: IMessage) => void) {
  if (!client?.connected) return () => {};
  const sub = client.subscribe(destino, onMsg);
  return () => {
    try { sub.unsubscribe(); } catch { /* conexión ya cerrada */ }
  };
}

/** Ubicación del conductor y cambios de estado del viaje (todos los participantes). */
export function suscribirseAUbicacion(viajeId: string, onEvento: (e: UbicacionEvento) => void) {
  const quitarTopic = suscribir(`/topic/viaje.${viajeId}.ubicacion`, (frame) => {
    onEvento(JSON.parse(frame.body) as UbicacionEvento);
  });

  // Cola privada de errores de negocio (viaje no EN_CURSO, sin permiso, etc.)
  const quitarErrores = suscribir('/user/queue/errores', (frame) => {
    try {
      const { mensaje } = JSON.parse(frame.body);
      console.warn('Tracking error:', mensaje);
    } catch { /* ignorar */ }
  });

  return () => { quitarTopic(); quitarErrores(); };
}

/** Solo conductor: posiciones en vivo de sus pasajeros (cola privada). */
export function suscribirseAPasajeros(onEvento: (e: UbicacionEvento) => void) {
  return suscribir('/user/queue/ubicaciones-pasajeros', (frame) => {
    onEvento(JSON.parse(frame.body) as UbicacionEvento);
  });
}

function publicar(destination: string, viajeId: string, lat: number, lng: number) {
  if (!client?.connected) return false;
  client.publish({ destination, body: JSON.stringify({ viajeId, lat, lng }) });
  return true;
}

/** El conductor publica la posición del vehículo (llega a todos los del viaje). */
export const enviarUbicacion = (viajeId: string, lat: number, lng: number) =>
  publicar('/app/viaje.ubicacion', viajeId, lat, lng);

/** Un pasajero publica su posición (el backend la entrega solo al conductor). */
export const enviarUbicacionPasajero = (viajeId: string, lat: number, lng: number) =>
  publicar('/app/viaje.ubicacion.pasajero', viajeId, lat, lng);
