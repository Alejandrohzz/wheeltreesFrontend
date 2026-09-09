import { useAppTheme } from '@/contexts/ThemeContext';

/**
 * Reemplaza el useColorScheme nativo de React Native: en vez de seguir el
 * ajuste del sistema operativo, sigue el modo de WheelTrees (automático por
 * hora, o claro/oscuro fijado por el usuario en su perfil).
 */
export function useColorScheme(): 'light' | 'dark' {
  const { isDark } = useAppTheme();
  return isDark ? 'dark' : 'light';
}
