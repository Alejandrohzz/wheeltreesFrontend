import { Client, IMessage } from '@stomp/stompjs';
import { apiFetch, BASE_URL, getToken } from './api';

export interface Mensaje {
  id:              string;
  remitenteId:     string;
  remitenteNombre: string;
  destinatarioId:  string;
  contenido:       string;
  enviadoEn:       string; // ISO 8601
}

/** Una fila en "Mis chats": un resumen por persona, no por viaje/reserva. */
export interface ChatResumen {
  otroUsuarioId:     string;
  otroUsuarioNombre: string;
  ultimoMensaje?:    string;
  ultimoMensajeEn?:  string;
  noLeidos:          number;
}

/** GET /api/chat/{otroUsuarioId}/mensajes — historial con esa persona */
export const historialChat = (otroUsuarioId: string) =>
  apiFetch<Mensaje[]>(`/api/chat/${otroUsuarioId}/mensajes`);

/** GET /api/chat/mis-chats — personas con quienes ya se puede chatear */
export const misChats = () => apiFetch<ChatResumen[]>('/api/chat/mis-chats');

/** PATCH /api/chat/{otroUsuarioId}/leidos — marca como leídos sus mensajes */
export const marcarLeidos = (otroUsuarioId: string) =>
  apiFetch<void>(`/api/chat/${otroUsuarioId}/leidos`, { method: 'PATCH' });

/**
 * POST /api/chat/{otroUsuarioId}/mensajes — envía y GUARDA el mensaje de
 * inmediato, sin importar si el otro participante está conectado o no.
 * Esta es la vía principal de envío: no depende del WebSocket, así que
 * funciona aunque la conexión en tiempo real todavía se esté estableciendo
 * (el backend igual retransmite por WS a quien esté escuchando).
 */
export const enviarMensajeRest = (otroUsuarioId: string, contenido: string) =>
  apiFetch<Mensaje>(`/api/chat/${otroUsuarioId}/mensajes`, {
    method: 'POST',
    body: JSON.stringify({ contenido }),
  });

// ─────────────────────────────────────────────────────────────────────────
// Cliente WebSocket/STOMP en tiempo real
// ─────────────────────────────────────────────────────────────────────────

function wsUrl(token: string): string {
  const base = BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}

/**
 * Mismo criterio de orden que usa el backend (String.compareTo sobre el
 * UUID en texto) para armar el nombre del topic — así da igual quién de
 * los dos haya iniciado la conversación.
 */
function topicPar(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

let client: Client | null = null;

/**
 * Abre la conexión STOMP (una sola por sesión de chat activa).
 * onConnect se dispara cuando ya se puede suscribir/enviar.
 */
export async function conectarChat(onConnect: () => void, onError?: (err: string) => void) {
  const token = await getToken();
  if (!token) {
    onError?.('No hay sesión activa');
    return null;
  }

  // Mismo fix que en tracking.ts: evita conexiones duplicadas si esta
  // función se llama dos veces antes de que se limpie la anterior.
  if (client) {
    client.deactivate();
    client = null;
  }

  const url = wsUrl(token);
  if (__DEV__) console.log('🔌 Conectando chat a', url);

  client = new Client({
    brokerURL: url,
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: (msg) => { if (__DEV__) console.log('[STOMP]', msg); },
    onConnect: () => {
      if (__DEV__) console.log('🔌 Chat conectado');
      onConnect();
    },
    onStompError: (frame) => {
      console.log('🔌 STOMP error:', frame.headers['message'], frame.body);
      onError?.(frame.headers['message'] ?? 'Error de conexión');
    },
    onWebSocketError: (event) => {
      console.log('🔌 WebSocket error crudo:', JSON.stringify(event));
      onError?.('No se pudo conectar al chat (revisa que el backend esté corriendo y en la misma red)');
    },
    onWebSocketClose: (event) => {
      console.log('🔌 WebSocket cerrado. Código:', event?.code, 'Razón:', event?.reason);
    },
  });

  client.activate();
  return client;
}

/** Se suscribe a los mensajes en vivo con una persona puntual. */
export function suscribirseAPersona(
  miId: string,
  otroUsuarioId: string,
  onMensaje: (m: Mensaje) => void,
) {
  if (!client) return () => {};

  const topic = `/topic/chat.${topicPar(miId, otroUsuarioId)}`;
  const sub = client.subscribe(topic, (frame: IMessage) => {
    onMensaje(JSON.parse(frame.body) as Mensaje);
  });

  // Cola privada de errores de negocio (sin relación confirmada, etc.)
  const subErrores = client.subscribe('/user/queue/errores', (frame: IMessage) => {
    const { mensaje } = JSON.parse(frame.body);
    console.warn('Chat error:', mensaje);
  });

  return () => {
    sub.unsubscribe();
    subErrores.unsubscribe();
  };
}

/** Envía un mensaje nuevo por WebSocket (llega a ambos participantes en vivo). */
export function enviarMensajeWs(destinatarioId: string, contenido: string) {
  if (!client?.connected) return false;
  client.publish({
    destination: '/app/chat.enviar',
    body: JSON.stringify({ destinatarioId, contenido }),
  });
  return true;
}

export function desconectarChat() {
  client?.deactivate();
  client = null;
}
