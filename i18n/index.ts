import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

i18next.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: 'es', // se sobreescribe en tiempo de ejecución desde LanguageContext
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18next;
