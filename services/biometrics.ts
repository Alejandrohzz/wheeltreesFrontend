import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_FLAG_KEY = 'wt_biometric_enabled';
const ULTIMO_USUARIO_KEY = 'wt_ultimo_usuario';

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

  // PRIMER INTENTO: biometría pura. No dejamos que iOS sustituya
  // inmediatamente Face ID por el código del dispositivo.
  const biometria = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
    disableDeviceFallback: true,
  });

  if (biometria.success) return true;

  // SEGUNDO INTENTO: solo después de que la biometría no haya sido válida,
  // permitimos el código/PIN del dispositivo como respaldo.
  const respaldo = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Usa Face ID o el código del iPhone para continuar',
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar código del iPhone',
    disableDeviceFallback: false,
  });

  return respaldo.success;
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
