import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider as AppThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { registrarNotificacionesPush, suscribirseANotificaciones } from '@/services/notifications';
import '@/i18n';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

function SplashOverlay({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFinish, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.splash}>
      <Image
        source={require('../assets/images/wheel-trees-icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.titleWhite}>
        WHEEL-<Text style={styles.titleGreen}>TREES</Text>
      </Text>
    </View>
  );
}

/** Contenido de la app: vive dentro de AuthProvider. */
function AppShell() {
  const colorScheme = useColorScheme();
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();
  const { usuario } = useAuth();

  // Con sesión iniciada: pide permiso de notificaciones, obtiene el token push
  // de este dispositivo y lo registra en el backend. Antes esto nunca se
  // llamaba, por eso no llegaba ninguna notificación nativa.
  useEffect(() => {
    if (usuario?.id) registrarNotificacionesPush();
  }, [usuario?.id]);

  // Cuando el usuario toca una notificación push (con la app cerrada o en
  // segundo plano), navega a la pantalla que tiene sentido según qué la
  // disparó — así no se queda parado en el splash/home sin contexto.
  useEffect(() => {
    const limpiar = suscribirseANotificaciones((data) => {
      switch (data?.tipo) {
        case 'nueva_solicitud':
        case 'reserva_cancelada':
          router.push('/notifications');
          break;
        case 'respuesta_reserva':
        case 'reserva_confirmada':
        case 'reserva_rechazada':
        case 'viaje_cancelado':
        case 'viaje_completado':
          router.push('/my-reservations');
          break;
        case 'viaje_iniciado':
          if (data.viajeId) router.push({ pathname: '/trip-tracking', params: { viajeId: String(data.viajeId) } });
          else router.push('/home');
          break;
        case 'nuevo_mensaje':
          if (data.remitenteId) {
            router.push({
              pathname: '/chat',
              params: { otroUsuarioId: String(data.remitenteId), otroUsuarioNombre: String(data.remitenteNombre ?? '') },
            });
          } else {
            router.push('/chats');
          }
          break;
        case 'vehiculo_aprobado':
        case 'vehiculo_rechazado':
          router.push('/vehicles');
          break;
        case 'recordatorio_viaje':
          router.push('/home');
          break;
        default:
          break;
      }
    });
    return limpiar;
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login"    options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="vehicles" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle-form" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
        <Stack.Screen name="publish-trip" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="chats" options={{ headerShown: false }} />
        <Stack.Screen name="chat"  options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="my-reservations" options={{ headerShown: false }} />
        <Stack.Screen name="my-trips" options={{ headerShown: false }} />
        <Stack.Screen
          name="start-trip"
          options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }}
        />
        <Stack.Screen name="available-trips" options={{ headerShown: false }} />
        <Stack.Screen name="trip-in-progress" options={{ headerShown: false }} />
        <Stack.Screen name="trip-tracking" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"   options={{ headerShown: false }} />
        <Stack.Screen name="modal"    options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      {showSplash && <SplashOverlay onFinish={() => setShowSplash(false)} />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </LanguageProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#131517',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logo:       { width: 200, height: 200 },
  titleWhite: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2, marginTop: 24 },
  titleGreen: { fontSize: 28, fontWeight: '800', color: '#3DBE7A', letterSpacing: 2 },
});