import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// IP local de Metro (solo sirve si el celular está en tu misma WiFi que la
// laptop corriendo `expo start`). Se usa como último recurso.
const devLanHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

// EXPO_PUBLIC_API_URL se define en `.env` (o en el perfil de EAS Build) y
// queda incrustada en el bundle al compilar. Con esto el APK que instalen
// los usuarios de prueba apunta siempre al backend desplegado en la nube,
// sin importar en qué red estén ni si tu laptop está prendida.
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? `http://${devLanHost}:8080` : 'https://back-wheeltrees-gggghvctbvhtdfce.westus3-01.azurewebsites.net');

const TOKEN_KEY = 'wt_access_token';

// El token se guarda en SecureStore (cifrado por el sistema operativo),
// en vez de AsyncStorage, porque es la pieza que la pantalla de
// biometría protege.
export const saveToken  = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const getToken   = ()              => SecureStore.getItemAsync(TOKEN_KEY);
export const clearToken = ()              => SecureStore.deleteItemAsync(TOKEN_KEY);

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Log temporal para debug
  if (__DEV__) {
    console.log('→', options.method ?? 'GET', `${BASE_URL}${path}`, options.body ?? '');
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (__DEV__) {
      // Log completo de la respuesta de error para depurar (Spring suele
      // devolver detalles en "errors"/"error" en vez de "message").
      console.log('✗ Error response', res.status, JSON.stringify(data));
    }

    // Intenta extraer el mensaje más útil posible, cubriendo los formatos
    // típicos de error de Spring Boot / validación de Bean Validation.
    let mensaje: string | undefined = data?.message;

    if (!mensaje && Array.isArray(data?.errors) && data.errors.length > 0) {
      mensaje = data.errors
        .map((e: any) => e?.defaultMessage ?? e?.message ?? `${e?.field ?? ''} inválido`)
        .join(', ');
    }

    // Formato propio del backend WheelTrees: { error, detalle, status }
    if (!mensaje && data?.errores && typeof data.errores === 'object') {
      mensaje = Object.values(data.errores).join(', ');
    }

    if (!mensaje && data?.error) {
      mensaje = data?.detalle ? `${data.error}: ${data.detalle}` : data.error;
    }

    throw new Error(mensaje ?? `Error ${res.status}`);
  }

  return data as T;
}
