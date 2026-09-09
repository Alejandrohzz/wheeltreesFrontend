import { useAppTheme } from '@/contexts/ThemeContext';
import { cancelarViaje, iniciarViaje, listarMisViajes } from '@/services/viajes';
import { Viaje } from '@/services/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
  amber:     '#E0B84C',
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
  amber: '#E0B84C',
};

const BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PROGRAMADO: { label: 'Programado', color: DARK_C.accent, bg: 'rgba(74,144,217,0.15)' },
  EN_CURSO:   { label: 'En curso',   color: DARK_C.amber,  bg: 'rgba(224,184,76,0.15)' },
  COMPLETADO: { label: 'Completado', color: DARK_C.green,  bg: 'rgba(61,190,122,0.15)' },
  CANCELADO:  { label: 'Cancelado',  color: DARK_C.red,    bg: 'rgba(224,92,92,0.15)' },
};

export default function MyTripsScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const [viajes, setViajes]     = useState<Viaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await listarMisViajes();
      // Los más próximos a salir primero; entre estados iguales, por fecha.
      data.sort((a, b) => new Date(a.fechaHoraSalida).getTime() - new Date(b.fechaHoraSalida).getTime());
      setViajes(data);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudieron cargar tus viajes');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const handleIniciar = async (viaje: Viaje) => {
    setProcesandoId(viaje.id);
    try {
      await iniciarViaje(viaje.id);
      // Al confirmar/iniciar el viaje con los pasajeros ya reservados,
      // se vuelve al home: ahí mismo se activa el seguimiento en vivo
      // (se empieza a compartir la ubicación) y aparece el botón de
      // finalizar viaje, sin tener que entrar a otra pantalla.
      router.replace('/home');
    } catch (e: any) {
      Alert.alert('No se pudo iniciar el viaje', e?.message ?? 'Inténtalo de nuevo');
    } finally {
      setProcesandoId(null);
    }
  };

  const handleCancelar = (viaje: Viaje) => {
    Alert.alert(
      'Cancelar viaje',
      '¿Seguro que quieres cancelar este viaje? Se avisará a los pasajeros con reserva.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setProcesandoId(viaje.id);
            try {
              await cancelarViaje(viaje.id);
              cargar();
            } catch (e: any) {
              Alert.alert('No se pudo cancelar', e?.message ?? 'Inténtalo de nuevo');
            } finally {
              setProcesandoId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mis viajes</Text>
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
              <Text style={s.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!cargando && !error && viajes.length === 0 && (
          <View style={s.centerBox}>
            <Text style={s.emptyText}>Todavía no has publicado ningún viaje.</Text>
          </View>
        )}

        {!cargando && !error && viajes.map((v) => {
          const badge = BADGE[v.estado] ?? BADGE.PROGRAMADO;
          const procesando = procesandoId === v.id;

          return (
            <View key={v.id} style={s.card}>
              <View style={[s.badge, { backgroundColor: badge.bg }]}>
                <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>

              <Text style={s.ruta}>{v.origenDescripcion} → {v.destinoDescripcion}</Text>
              <Text style={s.detail}>
                🗓️ {new Date(v.fechaHoraSalida).toLocaleString('es-CO', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>
              <Text style={s.detail}>
                🚗 {v.vehiculoDescripcion} · {v.cuposDisponibles}/{v.cuposTotales} cupos libres
              </Text>

              {v.estado === 'PROGRAMADO' && (
                <View style={s.actionsRow}>
                  <TouchableOpacity
                    style={[s.actionBtn, s.cancelBtn, procesando && s.disabled]}
                    activeOpacity={0.7}
                    disabled={procesando}
                    onPress={() => handleCancelar(v)}
                  >
                    <Text style={s.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, s.startBtn, procesando && s.disabled]}
                    activeOpacity={0.7}
                    disabled={procesando}
                    onPress={() => handleIniciar(v)}
                  >
                    {procesando
                      ? <ActivityIndicator color="#0A0A0A" size="small" />
                      : <Text style={s.startText}>🚀 Iniciar viaje</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {v.estado === 'EN_CURSO' && (
                <TouchableOpacity
                  style={[s.actionBtn, s.manageBtn, { marginTop: 14 }]}
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/trip-in-progress', params: { viajeId: v.id } })}
                >
                  <Text style={s.manageText}>📍 Gestionar viaje en curso</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: C.text },
  headerTitle: { fontSize: 19, fontWeight: '700', color: C.text },
  headerDivider: { height: 1, backgroundColor: C.border },

  scroll: { padding: 20, gap: 16 },

  centerBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  errorText: { color: C.red, fontSize: 14, textAlign: 'center' },
  emptyText: { color: C.textSub, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1, borderColor: C.accent, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  retryText: { color: C.accent, fontWeight: '600' },

  card: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1,
    borderColor: C.border, padding: 18,
  },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, marginBottom: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

  ruta:   { fontSize: 16, fontWeight: '700', color: C.text },
  detail: { fontSize: 13, color: C.textSub, marginTop: 4 },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12,
  },
  disabled: { opacity: 0.6 },
  cancelBtn:  { borderWidth: 1, borderColor: C.red },
  cancelText: { color: C.red, fontWeight: '700', fontSize: 14 },
  startBtn:   { backgroundColor: C.green },
  startText:  { color: '#0A0A0A', fontWeight: '700', fontSize: 14 },
  manageBtn:  { backgroundColor: 'rgba(224,184,76,0.15)', borderWidth: 1, borderColor: C.amber },
  manageText: { color: C.amber, fontWeight: '700', fontSize: 14 },
});
}
