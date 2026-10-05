import { contarChatsNoLeidos, contarNotificaciones } from '@/services/contadores';
import { fijarBadgeApp } from '@/services/notifications';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const CADA_MS = 20000;

/**
 * Contadores para los íconos del home (chat y notificaciones) y para el número
 * sobre el ícono de la app. Se refrescan al abrir, cada 20 s, al volver a la app
 * y apenas llega una notificación push.
 */
export function useContadores(esConductor: boolean, activo: boolean) {
  const [chats, setChats] = useState(0);
  const [notificaciones, setNotificaciones] = useState(0);
  const enCurso = useRef(false);

  const refrescar = useCallback(async () => {
    if (!activo || enCurso.current) return;
    enCurso.current = true;
    try {
      const [c, n] = await Promise.all([
        contarChatsNoLeidos().catch(() => null),
        contarNotificaciones(esConductor).catch(() => null),
      ]);
      const chatsFinal = c ?? 0;
      const notifFinal = n ?? 0;
      if (c != null) setChats(c);
      if (n != null) setNotificaciones(n);
      fijarBadgeApp(chatsFinal + notifFinal);
    } finally {
      enCurso.current = false;
    }
  }, [esConductor, activo]);

  useEffect(() => {
    if (!activo) return;
    refrescar();
    const id = setInterval(refrescar, CADA_MS);
    const appSub = AppState.addEventListener('change', (st) => { if (st === 'active') refrescar(); });
    const pushSub = Notifications.addNotificationReceivedListener(() => { refrescar(); });
    return () => { clearInterval(id); appSub.remove(); pushSub.remove(); };
  }, [activo, refrescar]);

  return { chats, notificaciones, refrescar };
}
