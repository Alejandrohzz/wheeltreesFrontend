import { useAppTheme } from '@/contexts/ThemeContext';
import {
  banearUsuario,
  cerrarSesionAdmin,
  desbanearUsuario,
  hayAdminActivo,
  listarReportes,
  listarVehiculosAdmin,
  detalleVehiculoAdmin,
  aprobarVehiculoAdmin,
  rechazarVehiculoAdmin,
  EstadoVehiculoAdmin,
  VehiculoAdminResumen,
  VehiculoAdminDetalle,
  marcarReporteResuelto,
  Reporte,
  Autor,
} from '@/services/admin';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const DARK_C = {
  bg:          '#131517',
  surface:     '#1E2126',
  surfaceAlt:  '#252A30',
  border:      '#2E343C',
  text:        '#FFFFFF',
  textMuted:   '#6B7785',
  textSub:     '#9BA3AD',
  accent:      '#4A90D9',
  accentGreen: '#3DBE7A',
  warning:     '#E0A93D',
  error:       '#E05C5C',
};

const LIGHT_C = {
  bg:          '#F5F7F8',
  surface:     '#FFFFFF',
  surfaceAlt:  '#EDEFF2',
  border:      '#DDE1E6',
  text:        '#11181C',
  textMuted:   '#7A8593',
  textSub:     '#5B6472',
  accent:      '#4A90D9',
  accentGreen: '#3DBE7A',
  warning:     '#C98A12',
  error:       '#E05C5C',
};

type Tab = 'reportes' | 'vehiculos';

const nombreAutor = (a: Autor) =>
  [a.nombre, a.apellido].filter(Boolean).join(' ') || a.email || '—';

const formatearFecha = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function AdminScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();

  const [tab, setTab]             = useState<Tab>('reportes');
  const [reportes, setReportes]   = useState<Reporte[]>([]);
  const [filtroVeh, setFiltroVeh] = useState<EstadoVehiculoAdmin>('PENDIENTE');
  const [vehiculos, setVehiculos] = useState<VehiculoAdminResumen[]>([]);
  const [pendientesVeh, setPendientesVeh] = useState(0);
  const [detalle, setDetalle]     = useState<VehiculoAdminDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [fotoGrande, setFotoGrande] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo]       = useState('');
  const [procesando, setProcesando] = useState(false);
  const [cargando, setCargando]   = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    const [r, v] = await Promise.all([
      listarReportes().catch((e: any) => {
        Alert.alert(t('admin.errorCargar'), e?.message ?? '');
        return [] as Reporte[];
      }),
      listarVehiculosAdmin(filtroVeh).catch((e: any) => {
        Alert.alert(t('admin.errorCargarVeh'), e?.message ?? '');
        return [] as VehiculoAdminResumen[];
      }),
    ]);
    setReportes(r);
    setVehiculos(v);
    if (filtroVeh === 'PENDIENTE') setPendientesVeh(v.length);
    else listarVehiculosAdmin('PENDIENTE').then((p) => setPendientesVeh(p.length)).catch(() => {});
  }, [filtroVeh, t]);

  // Cada vez que la pantalla toma foco recarga los datos; y si no hay sesión
  // de admin activa, devuelve al login.
  useFocusEffect(
    useCallback(() => {
      if (!hayAdminActivo()) {
        router.replace('/login');
        return;
      }
      setCargando(true);
      cargar().finally(() => setCargando(false));
    }, [cargar, router]),
  );

  const onRefresh = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const salir = () => {
    cerrarSesionAdmin();
    router.replace('/login');
  };

  const toggleReporte = async (r: Reporte) => {
    await marcarReporteResuelto(r.id, !r.resuelto);
    await cargar();
  };

  const toggleBaneo = (r: Reporte) => {
    if (!r.reportado?.id) return;
    const id = r.reportado.id;
    const activo = r.reportado.cuentaActiva;
    const nombre = nombreAutor(r.reportado);
    Alert.alert(
      t(activo ? 'admin.confirmBanTitle' : 'admin.confirmUnbanTitle'),
      t(activo ? 'admin.confirmBanMsg' : 'admin.confirmUnbanMsg', { nombre }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t(activo ? 'admin.banear' : 'admin.desbanear'),
          style: activo ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await (activo ? banearUsuario(id) : desbanearUsuario(id));
              await cargar();
            } catch (e: any) {
              Alert.alert(t('admin.errorBan'), e?.message ?? '');
            }
          },
        },
      ],
    );
  };

  const abrirDetalle = async (v: VehiculoAdminResumen) => {
    setCargandoDetalle(true);
    setDetalle({ ...(v as any) });
    try {
      setDetalle(await detalleVehiculoAdmin(v.id));
    } catch (e: any) {
      setDetalle(null);
      Alert.alert(t('admin.errorCargarVeh'), e?.message ?? '');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cerrarDetalle = () => {
    setDetalle(null);
    setRechazando(false);
    setMotivo('');
  };

  const aprobar = () => {
    if (!detalle) return;
    Alert.alert(
      t('admin.confirmAprobarTitle'),
      t('admin.confirmAprobarMsg', { placa: detalle.placa }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.aprobar'),
          onPress: async () => {
            setProcesando(true);
            try {
              await aprobarVehiculoAdmin(detalle.id);
              cerrarDetalle();
              await cargar();
            } catch (e: any) {
              Alert.alert(t('admin.errorDecidir'), e?.message ?? '');
            } finally {
              setProcesando(false);
            }
          },
        },
      ],
    );
  };

  const confirmarRechazo = async () => {
    if (!detalle) return;
    if (motivo.trim().length < 5) {
      Alert.alert(t('admin.motivoRequerido'));
      return;
    }
    setProcesando(true);
    try {
      await rechazarVehiculoAdmin(detalle.id, motivo.trim());
      cerrarDetalle();
      await cargar();
    } catch (e: any) {
      Alert.alert(t('admin.errorDecidir'), e?.message ?? '');
    } finally {
      setProcesando(false);
    }
  };

  const colorEstado = (e: string) =>
    e === 'APROBADO' ? C.accentGreen : e === 'RECHAZADO' ? C.error : C.warning;

  const reportesPend    = reportes.filter((r) => !r.resuelto).length;

  const TabBtn = ({ id, label, count }: { id: Tab; label: string; count: number }) => (
    <TouchableOpacity
      style={[s.tab, tab === id && s.tabActive]}
      onPress={() => setTab(id)}
      activeOpacity={0.8}
    >
      <Text style={[s.tabText, tab === id && s.tabTextActive]}>{label}</Text>
      {count > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const Fila = ({ label, value }: { label: string; value: string }) => (
    <View style={s.fila}>
      <Text style={s.filaLabel}>{label}</Text>
      <Text style={s.filaValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.pageTitle}>{t('admin.title')}</Text>
          <Text style={s.pageSub}>{t('admin.subtitle')}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={salir} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={C.error} />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        <TabBtn id="reportes"  label={t('admin.tabReportes')}  count={reportesPend} />
        <TabBtn id="vehiculos" label={t('admin.tabVehiculos')} count={pendientesVeh} />
      </View>

      {cargando ? (
        <View style={s.center}><ActivityIndicator color={C.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          {tab === 'reportes' && (
            reportes.length === 0 ? (
              <Text style={s.empty}>{t('admin.sinReportes')}</Text>
            ) : (
              reportes.map((r) => (
                <View key={r.id} style={[s.card, r.resuelto && s.cardDone]}>
                  <View style={s.cardTop}>
                    <Text style={s.cardTitle}>{nombreAutor(r.autor)}</Text>
                    <Text style={s.cardDate}>{formatearFecha(r.creadoEn)}</Text>
                  </View>
                  {!!r.autor.email && <Text style={s.cardMeta}>{r.autor.email}</Text>}
                  {!!r.reportado && (
                    <View style={s.reportadoBox}>
                      <Text style={s.reportadoLabel}>{t('admin.conductorReportado')}</Text>
                      <Text style={s.reportadoNombre}>
                        {nombreAutor(r.reportado)}
                        {!r.reportado.cuentaActiva ? `  ·  ${t('admin.suspendido')}` : ''}
                      </Text>
                      {!!r.reportado.email && <Text style={s.cardMeta}>{r.reportado.email}</Text>}
                      {!!r.viaje && (
                        <Text style={s.cardMeta}>
                          {t('admin.viajeReportado')}: {formatearFecha(r.viaje.fechaHoraSalida)} · {r.viaje.origen}
                        </Text>
                      )}
                    </View>
                  )}
                  <Text style={s.cardBody}>{r.texto}</Text>
                  {!!r.reportado?.id && (
                    <TouchableOpacity
                      style={[s.btn, r.reportado.cuentaActiva ? s.btnDanger : s.btnGhost, { marginBottom: 8 }]}
                      onPress={() => toggleBaneo(r)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.btnText, { color: r.reportado.cuentaActiva ? C.error : C.textSub }]}>
                        {r.reportado.cuentaActiva ? t('admin.banear') : t('admin.desbanear')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[s.btn, r.resuelto ? s.btnGhost : s.btnGreen]}
                    onPress={() => toggleReporte(r)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.btnText, r.resuelto && { color: C.textSub }]}>
                      {r.resuelto ? t('admin.reabrir') : t('admin.marcarResuelto')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )
          )}

          {tab === 'vehiculos' && (
            <>
              <View style={s.filtros}>
                {(['PENDIENTE', 'APROBADO', 'RECHAZADO'] as EstadoVehiculoAdmin[]).map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[s.filtro, filtroVeh === e && { borderColor: colorEstado(e) }]}
                    onPress={() => setFiltroVeh(e)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.filtroText, filtroVeh === e && { color: colorEstado(e) }]}>
                      {t(`admin.estado.${e}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {vehiculos.length === 0 ? (
                <Text style={s.empty}>{t('admin.sinSolicitudes')}</Text>
              ) : (
                vehiculos.map((v) => (
                  <View key={v.id} style={s.card}>
                    <View style={s.cardTop}>
                      <Text style={s.cardTitle}>{v.placa} · {v.marca} {v.modelo}</Text>
                      <View style={[s.estado, { borderColor: colorEstado(v.estadoVerificacion) }]}>
                        <Text style={[s.estadoText, { color: colorEstado(v.estadoVerificacion) }]}>
                          {t(`admin.estado.${v.estadoVerificacion}`)}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.cardMeta}>
                      {t('admin.solicitadoPor', { nombre: v.conductorNombre })}
                      {v.creadoEn ? ` · ${formatearFecha(v.creadoEn)}` : ''}
                    </Text>
                    <TouchableOpacity
                      style={[s.btn, s.btnGreen, { marginTop: 12 }]}
                      onPress={() => abrirDetalle(v)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.btnText}>
                        {v.estadoVerificacion === 'PENDIENTE' ? t('admin.revisarDocumentos') : t('admin.verDetalle')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Detalle del vehículo con documentos */}
      <Modal visible={!!detalle} animationType="slide" onRequestClose={cerrarDetalle}>
        <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={s.header}>
            <Text style={s.pageTitle}>{detalle?.placa}</Text>
            <TouchableOpacity style={s.logoutBtn} onPress={cerrarDetalle} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color={C.text} />
            </TouchableOpacity>
          </View>

          {cargandoDetalle || !detalle ? (
            <View style={s.center}><ActivityIndicator color={C.accent} /></View>
          ) : (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle}>{detalle.marca} {detalle.modelo} · {detalle.anio}</Text>
                <View style={[s.estado, { borderColor: colorEstado(detalle.estadoVerificacion) }]}>
                  <Text style={[s.estadoText, { color: colorEstado(detalle.estadoVerificacion) }]}>
                    {t(`admin.estado.${detalle.estadoVerificacion}`)}
                  </Text>
                </View>
              </View>
              <Text style={s.cardMeta}>
                {detalle.conductorNombre} · {detalle.conductorEmail}
              </Text>

              <View style={s.datos}>
                <Fila label={t('admin.tipo')}      value={detalle.tipo === 'MOTO' ? t('admin.moto') : t('admin.carro')} />
                <Fila label={t('admin.color')}     value={detalle.color ?? '—'} />
                <Fila label={t('admin.capacidad')} value={String(detalle.capacidadPasajeros ?? '—')} />
                <Fila label={t('admin.cedula')}    value={detalle.cedulaPropietario ?? '—'} />
              </View>

              {([
                ['admin.fotoLicencia', detalle.fotoLicencia],
                ['admin.fotoTarjeta',  detalle.fotoTarjetaPropiedad],
              ] as [string, string | null | undefined][]).map(([key, uri]) => (
                <View key={key} style={{ marginTop: 16 }}>
                  <Text style={s.filaLabel}>{t(key)}</Text>
                  {uri ? (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => setFotoGrande(uri)}>
                      <Image source={{ uri }} style={s.foto} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : (
                    <View style={[s.foto, s.fotoVacia]}>
                      <Text style={s.cardMeta}>{t('admin.sinFoto')}</Text>
                    </View>
                  )}
                </View>
              ))}

              {detalle.estadoVerificacion === 'RECHAZADO' && !!detalle.motivoRechazo && (
                <View style={s.reportadoBox}>
                  <Text style={s.reportadoLabel}>{t('admin.motivoRechazo')}</Text>
                  <Text style={s.cardBody}>{detalle.motivoRechazo}</Text>
                </View>
              )}

              {detalle.estadoVerificacion === 'PENDIENTE' && (
                rechazando ? (
                  <View style={{ marginTop: 20 }}>
                    <Text style={s.filaLabel}>{t('admin.motivoLabel')}</Text>
                    <TextInput
                      style={s.motivoInput}
                      value={motivo}
                      onChangeText={setMotivo}
                      placeholder={t('admin.motivoPlaceholder')}
                      placeholderTextColor={C.textMuted}
                      multiline
                      maxLength={500}
                    />
                    <View style={[s.actions, { marginTop: 12 }]}>
                      <TouchableOpacity
                        style={[s.btn, s.btnGhost, { flex: 1 }]}
                        onPress={() => { setRechazando(false); setMotivo(''); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.btnText, { color: C.textSub }]}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btn, s.btnDanger, { flex: 1 }]}
                        onPress={confirmarRechazo}
                        disabled={procesando}
                        activeOpacity={0.8}
                      >
                        {procesando
                          ? <ActivityIndicator color={C.error} />
                          : <Text style={[s.btnText, { color: C.error }]}>{t('admin.confirmarRechazo')}</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={[s.actions, { marginTop: 20 }]}>
                    <TouchableOpacity
                      style={[s.btn, s.btnDanger, { flex: 1 }]}
                      onPress={() => setRechazando(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.btnText, { color: C.error }]}>{t('admin.rechazar')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.btn, s.btnGreen, { flex: 1 }]}
                      onPress={aprobar}
                      disabled={procesando}
                      activeOpacity={0.8}
                    >
                      <Text style={s.btnText}>{t('admin.aprobar')}</Text>
                    </TouchableOpacity>
                  </View>
                )
              )}
            </ScrollView>
          )}
        </View>

        {/* Foto ampliada */}
        <Modal visible={!!fotoGrande} transparent animationType="fade" onRequestClose={() => setFotoGrande(null)}>
          <TouchableOpacity style={s.visor} activeOpacity={1} onPress={() => setFotoGrande(null)}>
            {!!fotoGrande && <Image source={{ uri: fotoGrande }} style={s.visorImg} resizeMode="contain" />}
          </TouchableOpacity>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
    pageSub:   { fontSize: 13, color: C.textSub, marginTop: 4 },
    logoutBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },

    tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
    tab: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 11, borderRadius: 12,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    },
    tabActive: { backgroundColor: C.accent, borderColor: C.accent },
    tabText: { fontSize: 14, fontWeight: '700', color: C.textSub },
    tabTextActive: { color: '#FFFFFF' },
    badge: {
      minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
      backgroundColor: C.error, alignItems: 'center', justifyContent: 'center',
    },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    filtros: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    filtro: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    filtroText: { color: C.textSub, fontSize: 12, fontWeight: '700' },
    foto: { width: '100%', height: 220, borderRadius: 12, marginTop: 6, backgroundColor: C.surfaceAlt },
    fotoVacia: { alignItems: 'center', justifyContent: 'center' },
    motivoInput: {
      minHeight: 90, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      borderRadius: 12, padding: 12, color: C.text, fontSize: 14, marginTop: 6, textAlignVertical: 'top',
    },
    visor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
    visorImg: { width: '100%', height: '90%' },
    empty: { textAlign: 'center', color: C.textMuted, fontSize: 14, marginTop: 48 },

    card: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      borderRadius: 16, padding: 16, marginBottom: 12,
    },
    cardDone: { opacity: 0.6 },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    cardTitle: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: C.text },
    cardDate: { fontSize: 12, color: C.textMuted },
    cardMeta: { fontSize: 12, color: C.textMuted, marginTop: 4 },
    reportadoBox: { backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 4 },
    reportadoLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600', marginBottom: 2 },
    reportadoNombre: { fontSize: 14, color: C.text, fontWeight: '700' },
    cardBody: { fontSize: 14, lineHeight: 20, color: C.textSub, marginTop: 10, marginBottom: 12 },

    estado: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    estadoText: { fontSize: 11, fontWeight: '800' },

    datos: {
      marginTop: 12, marginBottom: 12, padding: 12, borderRadius: 12,
      backgroundColor: C.surfaceAlt, gap: 6,
    },
    fila: { flexDirection: 'row', justifyContent: 'space-between' },
    filaLabel: { fontSize: 13, color: C.textMuted },
    filaValue: { fontSize: 13, fontWeight: '600', color: C.text },

    actions: { flexDirection: 'row', gap: 10 },
    btn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
    btnGreen: { backgroundColor: C.accentGreen, borderColor: C.accentGreen },
    btnDanger: { backgroundColor: 'transparent', borderColor: C.error },
    btnGhost: { backgroundColor: 'transparent', borderColor: C.border },
    btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  });
}
