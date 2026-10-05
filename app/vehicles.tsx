import { useAppTheme } from '@/contexts/ThemeContext';
import { desactivarVehiculo, listarVehiculos } from '@/services/vehiculos';
import { Vehiculo } from '@/services/types';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  bg:          '#131517',
  card:        '#1E2126',
  border:      '#2E343C',
  text:        '#FFFFFF',
  textMuted:   '#6B7785',
  textSub:     '#9BA3AD',
  accent:      '#4A90D9',
  accentGreen: '#3DBE7A',
  red:         '#E05C5C',
  warning:     '#E0A93D',
  badgeBg:     'rgba(61, 190, 122, 0.14)',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  card: '#FFFFFF',
  border: '#DDE1E6',
  text: '#11181C',
  textMuted: '#7A8593',
  textSub: '#5B6472',
  accent: '#4A90D9',
  accentGreen: '#3DBE7A',
  red: '#E05C5C',
  warning: '#C98A12',
  badgeBg: 'rgba(61, 190, 122, 0.14)',
};

export default function VehiclesScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await listarVehiculos();
      setVehiculos(data);
    } catch (e: any) {
      setError(e?.message ?? t('vehicles.errorLoad'));
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const handleDesactivar = (v: Vehiculo) => {
    Alert.alert(
      t('vehicles.deactivateAlertTitle'),
      t('vehicles.deactivateAlertMsg', { placa: v.placa }),
      [
        { text: t('vehicles.cancel'), style: 'cancel' },
        {
          text: t('vehicles.deactivate'),
          style: 'destructive',
          onPress: async () => {
            try {
              await desactivarVehiculo(v.id);
              cargar();
            } catch (e: any) {
              Alert.alert(t('vehicles.errorTitle'), e?.message ?? t('vehicles.errorDeactivate'));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.root}>
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('vehicles.title')}</Text>
        <TouchableOpacity
          style={s.newBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/vehicle-form')}
        >
          <Text style={s.newBtnText}>{t('vehicles.newButton')}</Text>
        </TouchableOpacity>
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
              <Text style={s.retryText}>{t('vehicles.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!cargando && !error && vehiculos.length === 0 && (
          <View style={s.centerBox}>
            <Text style={s.emptyText}>{t('vehicles.empty')}</Text>
          </View>
        )}

        {!cargando && !error && vehiculos.map((v) => (
          <View key={v.id} style={s.card}>
            <View style={s.badge}>
              {v.tipo === 'MOTO'
                ? <MaterialCommunityIcons name="motorbike" size={14} color={C.accentGreen} />
                : <Ionicons name="car-outline" size={14} color={C.accentGreen} />}
              <Text style={s.badgeText}>{v.tipo === 'MOTO' ? t('vehicles.tipoMoto') : t('vehicles.tipoCarro')}</Text>
            </View>

            <Text style={s.plate}>{v.placa}</Text>
            <Text style={s.model}>{v.marca} {v.modelo} · {v.anio}</Text>
            <Text style={s.detail}>
              {t('vehicles.colorLabel')}: {v.color}   ·   {t('vehicles.capacityLabel')}: {v.capacidadPasajeros} {t('vehicles.pax')}
            </Text>
            <Text style={s.detail}>{t('vehicles.ownerIdLabel')}: {v.cedulaPropietario}</Text>

            {/* Estado de la revisión del administrador */}
            {(() => {
              const est = v.estadoVerificacion ?? 'APROBADO';
              const color = est === 'APROBADO' ? C.accentGreen : est === 'RECHAZADO' ? C.red : C.warning;
              return (
                <View style={[s.estadoBox, { borderColor: color }]}>
                  <View style={s.estadoRow}>
                    <Ionicons
                      name={est === 'APROBADO' ? 'checkmark-circle' : est === 'RECHAZADO' ? 'close-circle' : 'time'}
                      size={16}
                      color={color}
                    />
                    <Text style={[s.estadoTitulo, { color }]}>{t(`vehicles.estado${est}`)}</Text>
                  </View>
                  {est === 'PENDIENTE' && <Text style={s.estadoMsg}>{t('vehicles.pendienteMsg')}</Text>}
                  {est === 'RECHAZADO' && (
                    <>
                      {!!v.motivoRechazo && (
                        <Text style={s.estadoMsg}>{t('vehicles.motivoRechazo')}: {v.motivoRechazo}</Text>
                      )}
                      <Text style={s.estadoMsg}>{t('vehicles.rechazadoMsg')}</Text>
                    </>
                  )}
                </View>
              );
            })()}

            <View style={s.actionsRow}>
              <TouchableOpacity
                style={[s.actionBtn, s.editBtn]}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/vehicle-form', params: { id: v.id } })}
              >
                <Text style={s.editText}>{t('vehicles.edit')}</Text>
              </TouchableOpacity>
              {(v.estadoVerificacion ?? 'APROBADO') === 'APROBADO' && (
                <TouchableOpacity
                  style={[s.actionBtn, s.deactivateBtn]}
                  activeOpacity={0.7}
                  onPress={() => handleDesactivar(v)}
                >
                  <Text style={s.deactivateText}>{t('vehicles.deactivate')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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
  newBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  newBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
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
    backgroundColor: C.badgeBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  badgeText: { color: C.accentGreen, fontSize: 12, fontWeight: '600' },

  plate: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: 0.5 },
  model: { fontSize: 15, fontWeight: '600', color: C.textSub, marginTop: 6 },
  detail: { fontSize: 13, color: C.textMuted, marginTop: 6 },

  estadoBox: { marginTop: 14, borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  estadoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estadoTitulo: { fontSize: 13, fontWeight: '800' },
  estadoMsg: { fontSize: 12, color: C.textSub, lineHeight: 17 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  editBtn:      { borderColor: C.accent },
  editText:     { color: C.accent, fontWeight: '700', fontSize: 14 },
  deactivateBtn:  { borderColor: C.red },
  deactivateText: { color: C.red, fontWeight: '700', fontSize: 14 },
});
}
