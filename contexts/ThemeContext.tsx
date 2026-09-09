import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

export type ThemeMode = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'wheeltrees:theme-mode';

// Horario en el que se considera "de día" (modo claro) cuando está en Automático.
const HORA_INICIO_CLARO = 6;  // 6:00 a.m.
const HORA_FIN_CLARO = 18;    // 6:00 p.m.

function calcularEsDeDia(): boolean {
  const hora = new Date().getHours();
  return hora >= HORA_INICIO_CLARO && hora < HORA_FIN_CLARO;
}

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'auto',
  isDark: true,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('auto');
  const [esDeDia, setEsDeDia] = useState(calcularEsDeDia);

  // Cargar preferencia guardada al iniciar (no bloquea el primer render).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((valor) => {
      if (valor === 'light' || valor === 'dark' || valor === 'auto') {
        setModeState(valor);
      }
    });
  }, []);

  // Recalcular la hora del día periódicamente y al volver a primer plano,
  // para que el cambio automático ocurra sin reiniciar la app.
  useEffect(() => {
    const actualizar = () => setEsDeDia(calcularEsDeDia());

    actualizar();
    const intervalo = setInterval(actualizar, 60 * 1000);

    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') actualizar();
    });

    return () => {
      clearInterval(intervalo);
      sub.remove();
    };
  }, []);

  const setMode = (nuevo: ThemeMode) => {
    setModeState(nuevo);
    AsyncStorage.setItem(STORAGE_KEY, nuevo).catch(() => {});
  };

  const isDark = mode === 'auto' ? !esDeDia : mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, isDark, setMode }),
    [mode, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
