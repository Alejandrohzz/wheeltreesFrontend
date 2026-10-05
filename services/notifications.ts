import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registrarPushToken } from './usuarios';

// Cómo se muestra una notificación mientras la app está ABIERTA en primer
// plano. Sin esto, expo-notifications no muestra nada visualmente cuando
// llega un push con la app abierta (solo la entregaría "silenciosa").
// Chat que el usuario tiene abierto ahora mismo: no se muestra banner de los
// mensajes de esa misma persona (ya los está viendo).
let chatAbiertoCon: string | null = null;
export const setChatAbierto = (otroUsuarioId: string | null) => { chatAbiertoCon = otroUsuarioId; };

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const data = (n.request.content.data ?? {}) as Record<string, any>;
    const delChatAbierto =
      data.tipo === 'nuevo_mensaje' && !!chatAbiertoCon && data.remitenteId === chatAbiertoCon;
    return {
      shouldShowBanner: !delChatAbierto,
      shouldShowList: !delChatAbierto,
      shouldPlaySound: !delChatAbierto,
      shouldSetBadge: false,
    };
  },
});

/** Número que se ve sobre el ícono de la app (como WhatsApp). */
export async function fijarBadgeApp(total: number) {
  try { await Notifications.setBadgeCountAsync(Math.max(0, total)); } catch { /* sin soporte */ }
}

/**
 * Pide permiso de notificaciones, obtiene el push token de Expo de este
 * dispositivo y lo manda al backend para que quede asociado al usuario
 * autenticado. Se debe llamar después de tener sesión iniciada (el
 * backend guarda el token contra el usuario del JWT).
 *
 * Devuelve el token si todo salió bien, o null si el usuario no dio
 * permiso, está en un simulador/emulador sin Google Play Services, o
 * algo falló — en ningún caso se lanza una excepción que rompa el login.
 */
export async function registrarNotificacionesPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      // Los push tokens reales no funcionan en simuladores/emuladores.
      return null;
    }

    if (Platform.OS === 'android') {
      // Importancia alta: la notificación aparece como aviso emergente.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'WheelTrees',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3DBE7A',
      });
    }

    const permisoActual = await Notifications.getPermissionsAsync();
    let estado = permisoActual.status;

    if (estado !== 'granted') {
      const solicitado = await Notifications.requestPermissionsAsync();
      estado = solicitado.status;
    }

    if (estado !== 'granted') {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await registrarPushToken(token);
    return token;
  } catch (e) {
    if (__DEV__) console.log('🔔 No se pudo registrar el push token:', e);
    return null;
  }
}

/**
 * Suscribe los listeners globales de notificaciones:
 * - onRecibida: llega un push con la app abierta (opcional, para refrescar datos en pantalla).
 * - onTocada: el usuario tocó la notificación (push cerrado/en segundo plano), útil para navegar.
 *
 * Devuelve una función de limpieza; llamarla en el cleanup del useEffect
 * donde se suscriba, para no acumular listeners duplicados en cada
 * recarga/remount.
 */
export function suscribirseANotificaciones(
  onTocada: (data: Record<string, any>) => void,
  onRecibida?: (data: Record<string, any>) => void,
) {
  const subTocada = Notifications.addNotificationResponseReceivedListener((respuesta) => {
    const data = respuesta.notification.request.content.data ?? {};
    onTocada(data);
  });

  const subRecibida = onRecibida
    ? Notifications.addNotificationReceivedListener((notificacion) => {
        onRecibida(notificacion.request.content.data ?? {});
      })
    : null;

  return () => {
    subTocada.remove();
    subRecibida?.remove();
  };
}
