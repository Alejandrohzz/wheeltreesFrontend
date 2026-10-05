import { useAppTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import PlaceAutocompleteInput from '@/components/PlaceAutocompleteInput';

type IconName = ComponentProps<typeof Ionicons>['name'];
import { useAuth } from '@/context/AuthContext';
import { getPlaceLatLng, PlacePrediction } from '@/services/places';
import { actualizarPerfil, actualizarRol, obtenerMiPerfil } from '@/services/usuarios';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DARK_C = {
  bg:          '#131517',
  surface:     '#1A1D21',
  card:        '#1E2126',
  border:      '#2E343C',
  text:        '#FFFFFF',
  textMuted:   '#6B7785',
  textSub:     '#9BA3AD',
  accentGreen: '#3DBE7A',
  red:         '#E05C5C',
  iconMuted:   '#4A5160',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#DDE1E6',
  text: '#11181C',
  textMuted: '#7A8593',
  textSub: '#5B6472',
  accentGreen: '#3DBE7A',
  red: '#E05C5C',
  iconMuted: '#9099A6',
};

// Sección de ítems del perfil
function Section({ title, items }: {
  title?: string;
  items: { icon: IconName; label: string; onPress?: () => void }[];
}) {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);

  return (
    <View style={s.section}>
      {title && <Text style={s.sectionTitle}>{title}</Text>}
      <View style={s.card}>
        {items.map((item, i) => (
          <View key={item.label}>
            <TouchableOpacity
              style={s.row}
              onPress={item.onPress}
              activeOpacity={item.onPress ? 0.7 : 1}
            >
              <View style={s.rowLeft}>
                <View style={s.iconBox}>
                  <Ionicons name={item.icon} size={18} color={C.accentGreen} />
                </View>
                <Text style={s.rowLabel}>{item.label}</Text>
              </View>
              {item.onPress && (
                <Text style={s.chevron}>›</Text>
              )}
            </TouchableOpacity>
            {i < items.length - 1 && <View style={s.divider} />}
          </View>
        ))}
      </View>
    </View>
  );
}

// Algunas cuentas de prueba quedaron con "string" guardado como dirección
// (el placeholder de ejemplo de Swagger, guardado sin editar al probar el
// endpoint). Se trata igual que si no hubiera dirección, en vez de
// mostrarlo tal cual.
function esDireccionValida(v: string | null | undefined): v is string {
  return !!v && v.trim().toLowerCase() !== 'string';
}

// Fila de dirección guardada (casa/trabajo), editable inline con autocompletado.
function DireccionRow({
  icon,
  label,
  direccion,
  lat,
  lng,
  guardando,
  onGuardar,
}: {
  icon: IconName;
  label: string;
  direccion: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
  guardando: boolean;
  onGuardar: (texto: string, lat: number, lng: number) => Promise<void>;
}) {
  const { isDark } = useAppTheme();
  const { t } = useTranslation();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const direccionValida = esDireccionValida(direccion) ? direccion : null;
  const [editando, setEditando]         = useState(false);
  const [texto, setTexto]               = useState(direccionValida ?? '');
  // Se inicializa con las coordenadas ya guardadas: si el usuario abre y
  // guarda sin tocar nada, no hace falta volver a seleccionar de la lista.
  // Si la dirección era la basura de "string", las coordenadas que la
  // acompañan tampoco sirven, así que se descartan junto con el texto.
  const [coords, setCoords]             = useState<{ lat: number; lng: number } | null>(
    direccionValida && lat != null && lng != null ? { lat, lng } : null,
  );
  const [resolviendo, setResolviendo]   = useState(false);

  useEffect(() => {
    setTexto(direccionValida ?? '');
    setCoords(direccionValida && lat != null && lng != null ? { lat, lng } : null);
  }, [direccion, lat, lng]);

  const handleChangeText = (t: string) => {
    setTexto(t);
    // Si escribe a mano después de haber seleccionado algo, esas
    // coordenadas ya no corresponden al texto — se invalidan.
    setCoords(null);
  };

  const handleSelectPlace = async (p: PlacePrediction) => {
    setResolviendo(true);
    try {
      const ll = await getPlaceLatLng(p.placeId);
      setCoords(ll);
    } catch {
      setCoords(null);
      Alert.alert(t('profile.noSePudoUbicarTitle'), t('profile.noSePudoUbicarMsg'));
    } finally {
      setResolviendo(false);
    }
  };

  const handleGuardar = async () => {
    if (!coords) {
      Alert.alert(t('profile.seleccionaDireccionTitle'), t('profile.seleccionaDireccionMsg'));
      return;
    }
    await onGuardar(texto, coords.lat, coords.lng);
    setEditando(false);
  };

  if (editando) {
    const bloqueado = guardando || resolviendo;
    return (
      <View style={s.direccionEditWrap}>
        <PlaceAutocompleteInput
          label={label}
          placeholder={`${t('profile.direccionDe')} ${label.toLowerCase()}`}
          value={texto}
          onChangeText={handleChangeText}
          onSelectPlace={handleSelectPlace}
          icon={<Ionicons name={icon} size={16} color={C.accentGreen} />}
        />
        <View style={s.direccionEditBtns}>
          <TouchableOpacity
            style={s.direccionCancelBtn}
            onPress={() => {
              setEditando(false);
              setTexto(direccionValida ?? '');
              setCoords(direccionValida && lat != null && lng != null ? { lat, lng } : null);
            }}
            activeOpacity={0.7}
          >
            <Text style={s.direccionCancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.direccionSaveBtn, bloqueado && { opacity: 0.6 }]}
            onPress={handleGuardar}
            disabled={bloqueado}
            activeOpacity={0.7}
          >
            {bloqueado
              ? <ActivityIndicator size="small" color="#0A0A0A" />
              : <Text style={s.direccionSaveText}>{t('common.save')}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={s.row} onPress={() => setEditando(true)} activeOpacity={0.7}>
      <View style={s.rowLeft}>
        <View style={s.iconBox}>
          <Ionicons name={icon} size={18} color={C.accentGreen} />
        </View>
        <View>
          <Text style={s.rowLabel}>{label}</Text>
          <Text style={s.direccionValue} numberOfLines={1}>
            {direccionValida ?? t('profile.tocaParaAgregar')}
          </Text>
        </View>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { isDark, mode, setMode } = useAppTheme();
  const { mode: languageMode, setMode: setLanguageMode } = useLanguage();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const {
    usuario,
    cerrarSesion,
    biometricDisponible,
    biometricActivada,
    habilitarBiometria,
    deshabilitarBiometria,
    actualizarUsuarioLocal,
  } = useAuth();
  const router = useRouter();

  const [perfil, setPerfil] = useState<{
    nombre: string; apellido: string; fotoPerfil: string | null; rol: string;
    direccionCasa?: string | null; casaLat?: number | null; casaLng?: number | null;
    direccionTrabajo?: string | null; trabajoLat?: number | null; trabajoLng?: number | null;
    calificacionPromedio?: number | null; totalCalificaciones?: number | null;
  } | null>(null);
  const [guardandoCasa, setGuardandoCasa]       = useState(false);
  const [guardandoTrabajo, setGuardandoTrabajo] = useState(false);
  const [cambiandoRol, setCambiandoRol]         = useState(false);

  useEffect(() => {
    obtenerMiPerfil().then(setPerfil).catch(() => {});
  }, []);

  const guardarCasa = async (direccion: string, lat: number, lng: number) => {
    if (!perfil) return;
    setGuardandoCasa(true);
    try {
      const actualizado = await actualizarPerfil({
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        fotoPerfil: perfil.fotoPerfil,
        direccionCasa: direccion,
        casaLat: lat,
        casaLng: lng,
        direccionTrabajo: perfil.direccionTrabajo,
        trabajoLat: perfil.trabajoLat,
        trabajoLng: perfil.trabajoLng,
      });
      setPerfil(actualizado);
    } catch (e: any) {
      Alert.alert(t('profile.noSePudoGuardarTitle'), e?.message ?? t('profile.intentaDeNuevo'));
    } finally {
      setGuardandoCasa(false);
    }
  };

  const guardarTrabajo = async (direccion: string, lat: number, lng: number) => {
    if (!perfil) return;
    setGuardandoTrabajo(true);
    try {
      const actualizado = await actualizarPerfil({
        nombre: perfil.nombre,
        apellido: perfil.apellido,
        fotoPerfil: perfil.fotoPerfil,
        direccionCasa: perfil.direccionCasa,
        casaLat: perfil.casaLat,
        casaLng: perfil.casaLng,
        direccionTrabajo: direccion,
        trabajoLat: lat,
        trabajoLng: lng,
      });
      setPerfil(actualizado);
    } catch (e: any) {
      Alert.alert(t('profile.noSePudoGuardarTitle'), e?.message ?? t('profile.intentaDeNuevo'));
    } finally {
      setGuardandoTrabajo(false);
    }
  };

  const handleCambiarRol = async (nuevoRol: 'CONDUCTOR' | 'PASAJERO') => {
    if (!perfil || perfil.rol === nuevoRol || cambiandoRol) return;

    setCambiandoRol(true);
    try {
      const actualizado = await actualizarRol(nuevoRol);
      setPerfil(actualizado);
      actualizarUsuarioLocal({ rol: actualizado.rol });
    } catch (e: any) {
      Alert.alert(t('profile.noSePudoCambiarRol'), e?.message ?? t('profile.intentaDeNuevo'));
    } finally {
      setCambiandoRol(false);
    }
  };

  const handleToggleBiometria = async (valor: boolean) => {
    if (valor) {
      const ok = await habilitarBiometria();
      if (!ok) {
        Alert.alert(
          t('profile.noSePudoActivarTitle'),
          t('profile.noSePudoActivarMsg'),
        );
      }
    } else {
      await deshabilitarBiometria();
    }
  };

  const nombre   = usuario?.nombre   ?? 'Usuario';
  const email    = usuario?.email    ?? '—';
  const rol      = usuario?.rol === 'CONDUCTOR' ? t('profile.roleConductor')
                  : usuario?.rol === 'PASAJERO' ? t('profile.rolePasajero')
                  : usuario?.rol ?? '—';
  const inicial  = nombre.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await cerrarSesion();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── TÍTULO ─────────────────────────────────────────────────────── */}
        <Text style={s.pageTitle}>{t('profile.pageTitle')}</Text>

        {/* ── TARJETA USUARIO ────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.card}>
            <TouchableOpacity style={s.userRow} activeOpacity={0.7}>
              <View style={s.avatarWrap}>
                <Text style={s.avatarInitial}>{inicial}</Text>
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{nombre}</Text>
                <Text style={s.userEmail}>{email}</Text>
                {/* Badge de tipo de usuario */}
                <View style={s.roleBadge}>
                  <View style={s.roleDot} />
                  <Text style={s.roleText}>{rol}</Text>
                </View>
                {perfil?.totalCalificaciones ? (
                  <Text style={s.ratingText}>
                    ★ {perfil.calificacionPromedio?.toFixed(1)} · {perfil.totalCalificaciones}{' '}
                    {perfil.totalCalificaciones === 1 ? t('profile.calificacionSingular') : t('profile.calificacionPlural')}
                  </Text>
                ) : null}
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── TIPO DE CUENTA: cambiar entre Conductor y Pasajero ───────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('profile.accountType')}</Text>
          <View style={s.card}>
            <View style={s.rolRow}>
              {(['PASAJERO', 'CONDUCTOR'] as const).map(r => {
                const activo = perfil?.rol === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[s.rolBtn, activo && s.rolBtnActive]}
                    onPress={() => handleCambiarRol(r)}
                    disabled={cambiandoRol || !perfil}
                    activeOpacity={0.7}
                  >
                    {cambiandoRol && perfil?.rol !== r ? (
                      <ActivityIndicator size="small" color={C.accentGreen} />
                    ) : (
                      <Text style={[s.rolBtnText, activo && s.rolBtnTextActive]}>
                        {r === 'PASAJERO' ? t('profile.rolePasajero') : t('profile.roleConductor')}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.rolHint}>
              {perfil?.rol === 'CONDUCTOR'
                ? t('profile.rolHintConductor')
                : t('profile.rolHintPasajero')}
            </Text>
          </View>
        </View>

        {/* ── VEHÍCULOS (solo conductores) ──────────────────────────────── */}
        {perfil?.rol === 'CONDUCTOR' && (
          <Section
            items={[
              { icon: 'car-outline', label: t('profile.misVehiculos'), onPress: () => router.push('/vehicles') },
            ]}
          />
        )}

        {/* ── DIRECCIONES GUARDADAS ──────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('profile.direccionesGuardadas')}</Text>
          <View style={s.card}>
            <DireccionRow
              icon="home-outline"
              label={t('profile.casa')}
              direccion={perfil?.direccionCasa}
              lat={perfil?.casaLat}
              lng={perfil?.casaLng}
              guardando={guardandoCasa}
              onGuardar={guardarCasa}
            />
            <View style={s.divider} />
            <DireccionRow
              icon="briefcase-outline"
              label={t('profile.trabajoEstudio')}
              direccion={perfil?.direccionTrabajo}
              lat={perfil?.trabajoLat}
              lng={perfil?.trabajoLng}
              guardando={guardandoTrabajo}
              onGuardar={guardarTrabajo}
            />
          </View>
        </View>

        {/* ── AYUDA ──────────────────────────────────────────────────────── */}
        <Section
          items={[
            { icon: 'help-buoy-outline', label: t('profile.ayuda'), onPress: () => router.push('/help') },
          ]}
        />

        {/* ── SEGURIDAD / BIOMETRÍA ──────────────────────────────────────── */}
        {biometricDisponible && (
          <View style={s.section}>
            <View style={s.card}>
              <View style={s.row}>
                <View style={s.rowLeft}>
                  <View style={s.iconBox}>
                    <Ionicons name="lock-closed-outline" size={18} color={C.accentGreen} />
                  </View>
                  <Text style={s.rowLabel}>{t('profile.inicioSesionBiometrico')}</Text>
                </View>
                <Switch
                  value={biometricActivada}
                  onValueChange={handleToggleBiometria}
                  trackColor={{ false: C.border, true: C.accentGreen }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        )}

        {/* ── APARIENCIA ─────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('profile.appearance')}</Text>
          <View style={s.card}>
            <View style={s.temaRow}>
              {([
                { value: 'auto',  label: t('profile.appearanceAuto'), icon: 'time-outline' as IconName },
                { value: 'light', label: t('profile.appearanceLight'), icon: 'sunny-outline' as IconName },
                { value: 'dark',  label: t('profile.appearanceDark'), icon: 'moon-outline' as IconName },
              ] as const).map((opcion) => {
                const activo = mode === opcion.value;
                return (
                  <TouchableOpacity
                    key={opcion.value}
                    style={[s.temaOpcion, activo && s.temaOpcionActiva]}
                    onPress={() => setMode(opcion.value)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={opcion.icon} size={20} color={C.accentGreen} />
                    <Text style={[s.temaLabel, activo && s.temaLabelActivo]}>
                      {opcion.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {mode === 'auto' && (
              <Text style={s.temaHint}>
                {t('profile.appearanceHint')}
              </Text>
            )}
          </View>
        </View>

        {/* ── IDIOMA ─────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Idioma / Language</Text>
          <View style={s.card}>
            <View style={s.temaRow}>
              {([
                { value: 'es',   label: 'Español',     icon: '🇪🇸' },
                { value: 'en',   label: 'English',     icon: '🇺🇸' },
              ] as const).map((opcion) => {
                const activo = languageMode === opcion.value;
                return (
                  <TouchableOpacity
                    key={opcion.value}
                    style={[s.temaOpcion, activo && s.temaOpcionActiva]}
                    onPress={() => setLanguageMode(opcion.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.temaIcono}>{opcion.icon}</Text>
                    <Text style={[s.temaLabel, activo && s.temaLabelActivo]}>
                      {opcion.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── LOG OUT ────────────────────────────────────────────────────── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={s.logoutIcon}>⎋</Text>
          <Text style={s.logoutText}>{t('profile.logOut')}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── TAB BAR ──────────────────────────────────────────────────────── */}
      <View style={s.tabBar}>
        <TouchableOpacity style={s.tabItem} onPress={() => router.replace('/home')} activeOpacity={0.7}>
          <View style={s.mapIconWrap}>
            <View style={s.mapLine} />
            <View style={[s.mapLine, { width: 10, marginLeft: 4 }]} />
            <View style={s.mapLine} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.tabItem} onPress={() => router.replace('/home')} activeOpacity={0.7}>
          <View style={s.locateOuter}>
            <View style={s.locateInner} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.tabItem} activeOpacity={0.7}>
          <View style={s.personIconWrap}>
            <View style={s.personHead} />
            <View style={s.personBody} />
          </View>
          <View style={s.tabDot} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    letterSpacing: -0.3,
  },

  // Secciones
  section:      { marginBottom: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textSub,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  // Selector de rol (Pasajero / Conductor)
  rolRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  rolBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  rolBtnActive: {
    borderColor: C.accentGreen,
    backgroundColor: '#1A2E22',
  },
  rolBtnText: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  rolBtnTextActive: { color: C.accentGreen },
  rolHint: {
    fontSize: 12,
    color: C.textMuted,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },

  // Fila genérica
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
  chevron:  { fontSize: 22, color: C.textMuted, lineHeight: 24 },
  divider:  { height: 1, backgroundColor: C.border, marginHorizontal: 16 },

  // Ícono con fondo verde
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(61, 190, 122, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 16 },

  // Tarjeta de usuario
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2E343C',
    borderWidth: 2,
    borderColor: C.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 22, fontWeight: '700', color: C.accentGreen },
  userInfo:      { flex: 1, gap: 2 },
  userName:      { fontSize: 16, fontWeight: '700', color: C.text },
  userEmail:     { fontSize: 13, color: C.textSub },

  // Badge de rol
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(61, 190, 122, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(61, 190, 122, 0.3)',
  },
  roleDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accentGreen },
  roleText: { fontSize: 11, fontWeight: '600', color: C.accentGreen },
  ratingText: { fontSize: 12, fontWeight: '600', color: '#F5B400', marginTop: 4 },

  // Direcciones guardadas
  direccionValue: { fontSize: 12, color: C.textSub, marginTop: 2, maxWidth: 220 },
  direccionEditWrap: { padding: 14 },
  direccionEditBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  direccionCancelBtn: { paddingHorizontal: 14, paddingVertical: 9 },
  direccionCancelText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  direccionSaveBtn: {
    backgroundColor: C.accentGreen,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    minWidth: 84,
    alignItems: 'center',
  },
  direccionSaveText: { color: '#0A0A0A', fontSize: 14, fontWeight: '700' },

  // Log out
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  logoutIcon: { fontSize: 16, color: C.red },
  logoutText: { fontSize: 15, fontWeight: '600', color: C.red },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabItem:      { flex: 1, alignItems: 'center', gap: 4 },
  tabDot:       { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accentGreen },

  // Map icon
  mapIconWrap:  { gap: 3, alignItems: 'flex-start' },
  mapLine:      { width: 18, height: 2, borderRadius: 1, backgroundColor: C.iconMuted },

  // Locate icon
  locateOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.iconMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.iconMuted },

  // Person icon (activo = verde)
  personIconWrap: { alignItems: 'center', gap: 2 },
  personHead:     { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accentGreen },
  personBody:     { width: 16, height: 8, borderRadius: 8, backgroundColor: C.accentGreen },

  // Selector de apariencia (Automático / Claro / Oscuro)
  temaRow: { flexDirection: 'row', padding: 12, gap: 8 },
  temaOpcion: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  temaOpcionActiva: {
    borderColor: C.accentGreen,
    backgroundColor: 'rgba(61,190,122,0.12)',
  },
  temaIcono: { fontSize: 18 },
  temaLabel: { fontSize: 12, fontWeight: '600', color: C.textSub },
  temaLabelActivo: { color: C.accentGreen },
  temaHint: {
    fontSize: 12,
    color: C.textMuted,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
}