import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { marcarVistos } from '@/services/contadores';
import { Viaje } from '@/services/types';
import { listarMisViajes } from '@/services/viajes';
import { misReservas, Reserva, reservasDeViaje, responderReserva } from '@/services/reservas';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
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

// NOTA: no hay un endpoint que traiga "todas mis notificaciones" de una sola
// vez, así que la pantalla arma la lista distinto según el rol:
//
//  CONDUCTOR: consulta sus viajes (GET /api/viajes/mis-viajes) y luego las
//  reservas de cada uno (GET /api/reservas/viaje/{viajeId}). Dos tipos de
//  tarjeta:
//    - PENDIENTE   → solicitud nueva, con botones Aceptar/Rechazar.
//    - CANCELADA   → aviso de que un pasajero canceló, solo informativo.
//
//  PASAJERO: consulta sus propias reservas (GET /api/reservas/mis-reservas).
//  Una tarjeta:
//    - COMPLETADA  → el conductor finalizó el viaje.
//
// El backend no guarda una fecha de cancelación/finalización (solo
// "creadoEn", la fecha en que se creó la reserva), así que no se puede
// filtrar por "recientes"; se muestran todas y el usuario puede
// descartarlas de la vista con "Entendido" (el descarte es solo local, no
// se guarda en el servidor).
const ESTADO_PENDIENTE  = 'PENDIENTE';
const ESTADO_CANCELADA  = 'CANCELADA';
const ESTADO_COMPLETADA = 'COMPLETADA';

type ReservaConViaje = Reserva & { destinoViaje?: string };

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { usuario } = useAuth();
  const esPasajero = usuario?.rol === 'PASAJERO';
  const [reservas, setReservas]     = useState<ReservaConViaje[]>([]);
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set());
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState('');
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      if (esPasajero) {
        // Pasajero: solo le interesa saber cuándo el conductor finalizó
        // el viaje de una reserva suya (CONFIRMADA → COMPLETADA).
        const misRes = await misReservas();
        const finalizadas = misRes
          .filter((r) => r.estado === ESTADO_COMPLETADA)
          .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
        setReservas(finalizadas);
        marcarVistos(finalizadas.map((r) => r.id));
        return;
      }

      const viajes: Viaje[] = await listarMisViajes();

      const listas = await Promise.all(
        viajes.map(async (v) => {
          try {
            const rs = await reservasDeViaje(v.id);
            return rs
              .filter((r) => r.estado === ESTADO_PENDIENTE || r.estado === ESTADO_CANCELADA)
              .map((r) => ({ ...r, destinoViaje: v.destinoDescripcion }));
          } catch {
            // Si un viaje puntual falla al traer reservas, se omite sin
            // romper el resto de la pantalla.
            return [];
          }
        })
      );

      const todas = listas.flat().sort(
        (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()
      );
      setReservas(todas);
      // Las cancelaciones son solo informativas: al verlas dejan de contar.
      marcarVistos(todas.filter((r) => r.estado === ESTADO_CANCELADA).map((r) => r.id));
    } catch (e: any) {
      setError(e?.message ?? t('notifications.errorLoad'));
    } finally {
      setCargando(false);
    }
  }, [esPasajero]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const responder = async (reserva: ReservaConViaje, aceptar: boolean) => {
    setProcesandoId(reserva.id);
    try {
      await responderReserva(reserva.id, aceptar);
      setReservas((prev) => prev.filter((r) => r.id !== reserva.id));
    } catch (e: any) {
      Alert.alert(t('notifications.errorTitle'), e?.message ?? t('notifications.errorResponder'));
    } finally {
      setProcesandoId(null);
    }
  };

  const descartar = (reservaId: string) => {
    setDescartadas((prev) => new Set(prev).add(reservaId));
  };

  const visibles = reservas.filter((r) => !descartadas.has(r.id));

  return (
    <SafeAreaView style={s.root}>
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('notifications.title')}</Text>
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
              <Text style={s.retryText}>{t('notifications.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!cargando && !error && visibles.length === 0 && (
          <View style={s.centerBox}>
            <Text style={s.emptyText}>
              {esPasajero ? t('notifications.emptyPasajero') : t('notifications.emptyConductor')}
            </Text>
          </View>
        )}

        {!cargando && !error && visibles.map((r) => {
          const procesando = procesandoId === r.id;
          const esCancelacion = r.estado === ESTADO_CANCELADA;
          const esFinalizado = esPasajero && r.estado === ESTADO_COMPLETADA;

          return (
            <View key={r.id} style={s.card}>
              <View style={[s.badge, (esCancelacion || esFinalizado) && s.badgeCancel, esFinalizado && s.badgeDone]}>
                <Text style={s.badgeIcon}>{esFinalizado ? '' : esCancelacion ? '' : ''}</Text>
                <Text style={[s.badgeText, (esCancelacion || esFinalizado) && s.badgeTextCancel, esFinalizado && s.badgeTextDone]}>
                  {esFinalizado ? t('notifications.viajeFinalizado') : esCancelacion ? t('notifications.reservaCancelada') : t('notifications.nuevaSolicitud')}
                </Text>
              </View>

              {esFinalizado ? (
                <Text style={s.passenger}>{r.conductorNombre}</Text>
              ) : (
                <>
                  <Text style={s.passenger}>{r.pasajeroNombre}</Text>
                  <Text style={s.email}>{r.pasajeroEmail}</Text>
                </>
              )}

              <Text style={s.detail}>
                {r.origenViaje}{r.destinoViaje ? ` → ${r.destinoViaje}` : ''}
              </Text>
              <Text style={s.detail}>
                {t('notifications.salePrefix')} {new Date(r.fechaHoraSalida).toLocaleString('es-CO', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>

              {esFinalizado && (
                <Text style={s.finalizadoText}>
                  {t('notifications.finalizadoMsg')}
                </Text>
              )}

              {!!r.notasPasajero && !esFinalizado && (
                <View style={s.notasBox}>
                  <Text style={s.notasLabel}>{t('notifications.notaPasajero')}</Text>
                  <Text style={s.notasText}>{r.notasPasajero}</Text>
                </View>
              )}

              {esCancelacion || esFinalizado ? (
                <TouchableOpacity
                  style={s.dismissBtn}
                  activeOpacity={0.7}
                  onPress={() => descartar(r.id)}
                >
                  <Text style={s.dismissText}>{t('notifications.entendido')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.actionsRow}>
                  <TouchableOpacity
                    style={[s.actionBtn, s.rejectBtn, procesando && s.disabled]}
                    activeOpacity={0.7}
                    disabled={procesando}
                    onPress={() => responder(r, false)}
                  >
                    <Text style={s.rejectText}>{t('notifications.rechazar')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, s.acceptBtn, procesando && s.disabled]}
                    activeOpacity={0.7}
                    disabled={procesando}
                    onPress={() => responder(r, true)}
                  >
                    {procesando ? (
                      <ActivityIndicator color="#0A0A0A" size="small" />
                    ) : (
                      <Text style={s.acceptText}>{t('notifications.aceptar')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
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

  scroll: { padding: 20, gap: 16 },

  centerBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  errorText: { color: C.red, fontSize: 14, textAlign: 'center' },
  emptyText: { color: C.textSub, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: C.accent, fontWeight: '600' },

  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74,144,217,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  badgeIcon: { fontSize: 13 },
  badgeText: { color: C.accent, fontSize: 12, fontWeight: '600' },
  badgeCancel: { backgroundColor: 'rgba(224,92,92,0.15)' },
  badgeTextCancel: { color: C.red },
  badgeDone: { backgroundColor: 'rgba(61,190,122,0.15)' },
  badgeTextDone: { color: C.green },

  passenger: { fontSize: 18, fontWeight: '700', color: C.text },
  email:     { fontSize: 12, color: C.textMuted, marginTop: 2, marginBottom: 10 },
  detail:    { fontSize: 13, color: C.textSub, marginTop: 2 },

  notasBox: {
    backgroundColor: '#181A1D',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  notasLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', marginBottom: 2 },
  notasText:  { fontSize: 13, color: C.textSub },
  finalizadoText: { fontSize: 13, color: C.textSub, marginTop: 10, fontStyle: 'italic' },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  disabled: { opacity: 0.6 },
  rejectBtn:  { borderWidth: 1, borderColor: C.red },
  rejectText: { color: C.red, fontWeight: '700', fontSize: 14 },
  acceptBtn:  { backgroundColor: C.green },
  acceptText: { color: '#0A0A0A', fontWeight: '700', fontSize: 14 },

  dismissBtn: {
    marginTop: 18,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  dismissText: { color: C.textSub, fontWeight: '600', fontSize: 13 },
});
}
