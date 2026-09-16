/**
 * Tokens de color compartidos para los componentes de components/atoms,
 * components/molecules y components/organisms.
 *
 * Esto NO reemplaza los objetos DARK_C/LIGHT_C que ya existen dentro de
 * cada pantalla en app/*.tsx — esas pantallas siguen funcionando exactamente
 * igual que antes. Este archivo es solo para los componentes nuevos de la
 * librería atómica, para que no queden hardcodeados y sea fácil mantenerlos
 * visualmente consistentes con el resto de la app.
 */
import { useAppTheme } from '@/contexts/ThemeContext';

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderFocus: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  error: string;
  success: string;
};

export const DARK_TOKENS: ColorTokens = {
  bg: '#131517',
  surface: '#1E2126',
  surfaceAlt: '#262B31',
  border: '#2E343C',
  borderFocus: '#4A90D9',
  text: '#FFFFFF',
  textMuted: '#6B7785',
  accent: '#4A90D9',
  accentText: '#FFFFFF',
  error: '#E05C5C',
  success: '#4CAF7D',
};

export const LIGHT_TOKENS: ColorTokens = {
  bg: '#F5F7F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F4',
  border: '#DDE1E6',
  borderFocus: '#4A90D9',
  text: '#11181C',
  textMuted: '#7A8593',
  accent: '#4A90D9',
  accentText: '#FFFFFF',
  error: '#E05C5C',
  success: '#2F9E5C',
};

/** Devuelve los tokens de color según el modo claro/oscuro activo de la app. */
export function useTokens(): ColorTokens {
  const { isDark } = useAppTheme();
  return isDark ? DARK_TOKENS : LIGHT_TOKENS;
}
