import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Guarda/lee la hora real (timestamp) en la que un viaje pasó a EN_CURSO,
 * para poder mostrarle al conductor un contador de minutos preciso en
 * "Viaje en curso" aunque salga de la pantalla y vuelva a entrar, o cierre
 * y abra la app de nuevo mientras el viaje sigue activo.
 */

const PREFIX = 'wt:viajeIniciadoEn:';

export async function guardarInicioViaje(viajeId: string, timestamp: number = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIX}${viajeId}`, String(timestamp));
  } catch {
    // Si falla el storage no es crítico: el contador simplemente
    // arrancará desde que se abrió la pantalla en vez de desde el inicio real.
  }
}

export async function obtenerInicioViaje(viajeId: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${viajeId}`);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export async function limpiarInicioViaje(viajeId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PREFIX}${viajeId}`);
  } catch {
    // no-op
  }
}
