import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider as AppThemeProvider } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login"    options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="vehicles" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle-form" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="publish-trip" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="chats" options={{ headerShown: false }} />
        <Stack.Screen name="chat"  options={{ headerShown: false }} />
        <Stack.Screen name="my-trips" options={{ headerShown: false }} />
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
    <AppThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </AppThemeProvider>
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
