import { Client, IMessage } from '@stomp/stompjs';
import { apiFetch, BASE_URL, getToken } from './api';

/**
 * Evento recibido por /topic/viaje.{id}.ubicacion. Sirve tanto para
 * posiciones GPS del conductor (lat/lng no nulos) como para avisos de
 * cambio de estado del viaje (iniciar/completar/cancelar), para que la
 * pantalla del pasajero sepa cuándo empieza y cuándo termina el
 * seguimiento sin necesidad de hacer polling.
 */
export interface UbicacionEvento {
  viajeId:        string;
  estado:         string; // PROGRAMADO | EN_CURSO | COMPLETADO | CANCELADO
  lat:            number | null;
  lng:            number | null;
  actualizadaEn:  string | null; // ISO 8601
}

/** GET /api/viajes/{id}/ubicacion — última posición conocida (carga inicial / respaldo) */
export const obtenerUbicacion = (viajeId: string) =>
  apiFetch<UbicacionEvento>(`/api/viajes/${viajeId}/ubicacion`);

// ─────────────────────────────────────────────────────────────────────────
// Cliente WebSocket/STOMP en tiempo real (independiente del de chat.ts,
// así ambas conexiones pueden convivir sin pisarse).
// ─────────────────────────────────────────────────────────────────────────

function wsUrl(token: string): string {
  const base = BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}

let client: Client | null = null;

/**
 * Abre la conexión STOMP para seguimiento de viaje.
 * onConnect se dispara cuando ya se puede suscribir/publicar.
 */
export async function conectarTracking(onConnect: () => void, onError?: (err: string) => void) {
  const token = await getToken();
  if (!token) {
    onError?.('No hay sesión activa');
    return null;
  }

  // Si ya había un cliente activo (p. ej. porque el efecto que llama a esta
  // función se disparó dos veces sin que se alcanzara a limpiar el
  // anterior), lo desactivamos primero. Sin esto, quedaban dos sockets
  // reintentando conexión en paralelo cada 3s indefinidamente, lo cual
  // terminaba disparando un 429 (demasiadas conexiones) del lado de Azure.
  if (client) {
    client.deactivate();
    client = null;
  }

  const url = wsUrl(token);
  if (__DEV__) console.log('🔌 Conectando tracking a', url);

  client = new Client({
    brokerURL: url,
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: (msg) => { if (__DEV__) console.log('[STOMP-tracking]', msg); },
    onConnect: () => {
      if (__DEV__) console.log('🔌 Tracking conectado');
      onConnect();
    },
    onStompError: (frame) => {
      console.log('🔌 STOMP error (tracking):', frame.headers['message'], frame.body);
      onError?.(frame.headers['message'] ?? 'Error de conexión');
    },
    onWebSocketError: (event) => {
      console.log('🔌 WebSocket error crudo (tracking):', JSON.stringify(event));
      onError?.('No se pudo conectar al seguimiento en tiempo real');
    },
    onWebSocketClose: (event) => {
      console.log('🔌 WebSocket de tracking cerrado. Código:', event?.code, 'Razón:', event?.reason);
    },
  });

  client.activate();
  return client;
}

/** Se suscribe a los eventos de ubicación/estado en vivo de un viaje puntual. */
export function suscribirseAUbicacion(
  viajeId: string,
  onEvento: (e: UbicacionEvento) => void,
) {
  if (!client) return () => {};

  const topic = `/topic/viaje.${viajeId}.ubicacion`;
  const sub = client.subscribe(topic, (frame: IMessage) => {
    onEvento(JSON.parse(frame.body) as UbicacionEvento);
  });

  // Cola privada de errores de negocio (viaje no EN_CURSO, sin permiso, etc.)
  const subErrores = client.subscribe('/user/queue/errores', (frame: IMessage) => {
    const { mensaje } = JSON.parse(frame.body);
    console.warn('Tracking error:', mensaje);
  });

  return () => {
    sub.unsubscribe();
    subErrores.unsubscribe();
  };
}

/** El conductor publica su posición GPS actual (llega a todos los suscritos en vivo). */
export function enviarUbicacion(viajeId: string, lat: number, lng: number) {
  if (!client?.connected) return false;
  client.publish({
    destination: '/app/viaje.ubicacion',
    body: JSON.stringify({ viajeId, lat, lng }),
  });
  return true;
}

export function desconectarTracking() {
  client?.deactivate();
  client = null;
}
