import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import i18next from '@/i18n';

export type LanguageMode = 'auto' | 'es' | 'en';

const STORAGE_KEY = 'wheeltrees:language-mode';

const IDIOMAS_SOPORTADOS = ['es', 'en'] as const;

function detectarIdiomaDelSistema(): 'es' | 'en' {
  const codigo = Localization.getLocales()[0]?.languageCode;
  return IDIOMAS_SOPORTADOS.includes(codigo as any) ? (codigo as 'es' | 'en') : 'es';
}

type LanguageContextValue = {
  mode: LanguageMode;
  /** Idioma efectivo ya resuelto (si mode es 'auto', el del sistema). */
  language: 'es' | 'en';
  setMode: (mode: LanguageMode) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  mode: 'auto',
  language: 'es',
  setMode: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<LanguageMode>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((valor) => {
      if (valor === 'es' || valor === 'en' || valor === 'auto') {
        setModeState(valor);
      }
    });
  }, []);

  const language = mode === 'auto' ? detectarIdiomaDelSistema() : mode;

  useEffect(() => {
    i18next.changeLanguage(language);
  }, [language]);

  const setMode = (nuevo: LanguageMode) => {
    setModeState(nuevo);
    AsyncStorage.setItem(STORAGE_KEY, nuevo).catch(() => {});
  };

  const value = useMemo<LanguageContextValue>(
    () => ({ mode, language, setMode }),
    [mode, language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
