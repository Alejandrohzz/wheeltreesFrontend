import AsyncStorage from '@react-native-async-storage/async-storage';
import { misChats } from './chat';
import { misReservas, reservasDeViaje } from './reservas';
import { listarMisViajes } from './viajes';

const CLAVE_VISTOS = 'wt:notifVistas';

/** Avisos informativos (cancelada/completada) que el usuario ya abrió. */
export async function obtenerVistos(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE_VISTOS);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function marcarVistos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const actuales = await obtenerVistos();
    ids.forEach((id) => actuales.add(id));
    // Tope para que no crezca sin límite.
    await AsyncStorage.setItem(CLAVE_VISTOS, JSON.stringify([...actuales].slice(-300)));
  } catch { /* no crítico */ }
}

/** Suma de mensajes sin leer de todos mis chats. */
export async function contarChatsNoLeidos(): Promise<number> {
  const chats = await misChats();
  return chats.reduce((acc, c) => acc + (c.noLeidos ?? 0), 0);
}

/**
 * Notificaciones pendientes, con el mismo criterio que la pantalla de avisos:
 *  - Conductor: solicitudes PENDIENTES (hasta que las responda) + cancelaciones sin ver.
 *  - Pasajero: viajes COMPLETADOS sin ver.
 */
export async function contarNotificaciones(esConductor: boolean): Promise<number> {
  const vistos = await obtenerVistos();

  if (!esConductor) {
    const rs = await misReservas();
    return rs.filter((r) => r.estado === 'COMPLETADA' && !vistos.has(r.id)).length;
  }

  const viajes = await listarMisViajes();
  const listas = await Promise.all(
    viajes.map((v) => reservasDeViaje(v.id).catch(() => [])),
  );
  return listas.flat().filter((r) =>
    r.estado === 'PENDIENTE' || (r.estado === 'CANCELADA' && !vistos.has(r.id)),
  ).length;
}
