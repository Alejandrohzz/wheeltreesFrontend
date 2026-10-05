import { useAppTheme } from '@/contexts/ThemeContext';
import { ChatResumen, misChats } from '@/services/chat';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DARK_C = {
  bg:        '#131517',
  card:      '#1E2126',
  border:    '#2E343C',
  text:      '#FFFFFF',
  textMuted: '#6B7785',
  textSub:   '#9BA3AD',
  accent:    '#4A90D9',
  green:     '#3DBE7A',
  red:       '#E05C5C',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  card: '#FFFFFF',
  border: '#DDE1E6',
  text: '#11181C',
  textMuted: '#7A8593',
  textSub: '#5B6472',
  accent: '#4A90D9',
  green: '#3DBE7A',
  red: '#E05C5C',
};

function formatearHora(iso?: string) {
  if (!iso) return '';
  const fecha = new Date(iso);
  const hoy = new Date();
  const esHoy = fecha.toDateString() === hoy.toDateString();
  return esHoy
    ? fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function ChatsScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const [chats, setChats]     = useState<ChatResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await misChats();
      // Conversaciones con actividad más reciente primero.
      data.sort((a, b) => {
        const ta = a.ultimoMensajeEn ? new Date(a.ultimoMensajeEn).getTime() : 0;
        const tb = b.ultimoMensajeEn ? new Date(b.ultimoMensajeEn).getTime() : 0;
        return tb - ta;
      });
      setChats(data);
    } catch (e: any) {
      setError(e?.message ?? t('chats.errorLoad'));
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('chats.title')}</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.headerDivider} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {cargando && (
          <View style={s.centerBox}>
            <ActivityIndicator color={C.accent} />
          </View>
        )}

        {!cargando && !!error && (
          <View style={s.centerBox}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={cargar} style={s.retryBtn}>
              <Text style={s.retryText}>{t('chats.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!cargando && !error && chats.length === 0 && (
          <View style={s.centerBox}>
            <Text style={s.emptyText}>
              {t('chats.empty')}
            </Text>
          </View>
        )}

        {!cargando && !error && chats.map((c) => (
          <TouchableOpacity
            key={c.otroUsuarioId}
            style={s.card}
            activeOpacity={0.7}
            onPress={() =>
              router.push({
                pathname: '/chat',
                params: { otroUsuarioId: c.otroUsuarioId, otroUsuarioNombre: c.otroUsuarioNombre },
              })
            }
          >
            <View style={s.avatar}>
              <Text style={s.avatarInitial}>{c.otroUsuarioNombre.charAt(0).toUpperCase()}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={s.rowTop}>
                <Text style={s.nombre} numberOfLines={1}>{c.otroUsuarioNombre}</Text>
                <Text style={s.hora}>{formatearHora(c.ultimoMensajeEn)}</Text>
              </View>
              <Text style={s.ultimo} numberOfLines={1}>
                {c.ultimoMensaje ?? t('chats.noMessages')}
              </Text>
            </View>

            {c.noLeidos > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{c.noLeidos}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: C.text },
  headerTitle: { fontSize: 19, fontWeight: '700', color: C.text },
  headerDivider: { height: 1, backgroundColor: C.border },

  scroll: { padding: 16, gap: 10 },

  centerBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  errorText: { color: C.red, fontSize: 14, textAlign: 'center' },
  emptyText: { color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: C.accent, fontWeight: '600' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(61,190,122,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: C.green },

  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: 15, fontWeight: '700', color: C.text, flexShrink: 1 },
  hora:   { fontSize: 11, color: C.textMuted, marginLeft: 8 },
  ultimo: { fontSize: 13, color: C.textMuted, marginTop: 4 },

  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#0A0A0A' },
});
}
