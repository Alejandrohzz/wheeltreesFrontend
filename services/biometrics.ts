import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_FLAG_KEY = 'wt_biometric_enabled';
const ULTIMO_USUARIO_KEY = 'wt_ultimo_usuario';
const INTENTOS_FALLIDOS_KEY = 'wt_biometric_fallos';

/** UR-002: tras este número de intentos fallidos seguidos se bloquea la biometría. */
export const MAX_INTENTOS_BIOMETRICOS = 3;

export interface EstadoBloqueoBiometrico {
  /** true cuando ya se agotaron los intentos: hay que desbloquear con el código del correo. */
  bloqueada: boolean;
  intentosFallidos: number;
  intentosRestantes: number;
}

async function leerIntentosFallidos(): Promise<number> {
  const v = await SecureStore.getItemAsync(INTENTOS_FALLIDOS_KEY);
  const n = v ? parseInt(v, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Cuántos intentos van y cuántos quedan antes del bloqueo. */
export async function obtenerEstadoBloqueoBiometrico(): Promise<EstadoBloqueoBiometrico> {
  const fallidos = await leerIntentosFallidos();
  return {
    bloqueada: fallidos >= MAX_INTENTOS_BIOMETRICOS,
    intentosFallidos: fallidos,
    intentosRestantes: Math.max(0, MAX_INTENTOS_BIOMETRICOS - fallidos),
  };
}

/** Suma un intento fallido y devuelve el estado resultante. */
export async function registrarIntentoBiometricoFallido(): Promise<EstadoBloqueoBiometrico> {
  const fallidos = (await leerIntentosFallidos()) + 1;
  await SecureStore.setItemAsync(INTENTOS_FALLIDOS_KEY, String(fallidos));
  return obtenerEstadoBloqueoBiometrico();
}

/** Pone el contador en cero (tras un éxito o tras desbloquear con el código del correo). */
export async function reiniciarIntentosBiometricos(): Promise<void> {
  await SecureStore.deleteItemAsync(INTENTOS_FALLIDOS_KEY);
}

// Cancelar el prompt no es un intento fallido: el usuario simplemente cerró el diálogo.
const ERRORES_DE_CANCELACION = ['user_cancel', 'system_cancel', 'app_cancel'];

/**
 * true solo si el dispositivo tiene sensor biométrico Y el usuario ya
 * registró al menos una huella/rostro en el sistema operativo.
 */
export async function biometriaDisponible(): Promise<boolean> {
  const tieneHardware = await LocalAuthentication.hasHardwareAsync();
  if (!tieneHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

/** Face ID, huella dactilar, iris... útil si quieres mostrar un texto/ícono distinto. */
export function tiposBiometricosSoportados() {
  return LocalAuthentication.supportedAuthenticationTypesAsync();
}

/**
 * Lanza el prompt nativo del sistema operativo (Face ID / huella, con
 * PIN o patrón como respaldo si falla el sensor).
 * Devuelve true solo si la verificación fue exitosa.
 */
export async function autenticarConBiometria(
  promptMessage = 'Confirma tu identidad para continuar',
): Promise<boolean> {
  const disponible = await biometriaDisponible();
  if (!disponible) return false;

  // UR-002: con 3 intentos fallidos la biometría queda bloqueada hasta que el
  // usuario la desbloquee con el código que se envía a su correo institucional.
  if ((await obtenerEstadoBloqueoBiometrico()).bloqueada) return false;

  // PRIMER INTENTO: biometría pura. No dejamos que iOS sustituya
  // inmediatamente Face ID por el código del dispositivo.
  const biometria = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
    disableDeviceFallback: true,
  });

  if (biometria.success) {
    await reiniciarIntentosBiometricos();
    return true;
  }

  // SEGUNDO INTENTO: solo después de que la biometría no haya sido válida,
  // permitimos el código/PIN del dispositivo como respaldo.
  const respaldo = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Usa Face ID o el código del iPhone para continuar',
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar código del iPhone',
    disableDeviceFallback: false,
  });

  if (respaldo.success) {
    await reiniciarIntentosBiometricos();
    return true;
  }

  // Fallo real (no una cancelación): cuenta como un intento fallido.
  const cancelo = !respaldo.success && ERRORES_DE_CANCELACION.includes((respaldo as any).error);
  if (!cancelo) await registrarIntentoBiometricoFallido();

  return false;
}

/** Preferencia del usuario: ¿quiere usar biometría para iniciar sesión en esta app? */
export async function biometriaActivada(): Promise<boolean> {
  const valor = await SecureStore.getItemAsync(BIOMETRIC_FLAG_KEY);
  return valor === 'true';
}

export async function setBiometriaActivada(activa: boolean): Promise<void> {
  if (activa) {
    await SecureStore.setItemAsync(BIOMETRIC_FLAG_KEY, 'true');
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_FLAG_KEY);
  }
}

/**
 * Recuerda el último usuario (sin dominio) que inició sesión en este
 * dispositivo, para prellenar el campo la próxima vez (como Nequi/Davivienda).
 * No es información sensible: solo el nombre de usuario, nunca la contraseña.
 */
export async function guardarUltimoUsuario(usuario: string): Promise<void> {
  await SecureStore.setItemAsync(ULTIMO_USUARIO_KEY, usuario);
}

export async function obtenerUltimoUsuario(): Promise<string | null> {
  return SecureStore.getItemAsync(ULTIMO_USUARIO_KEY);
}
