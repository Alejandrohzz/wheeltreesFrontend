import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { crearReporte } from '@/services/admin';
import { misReservas, Reserva } from '@/services/reservas';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DARK_C = {
  bg:          '#131517',
  surface:     '#1E2126',
  border:      '#2E343C',
  borderFocus: '#4A90D9',
  text:        '#FFFFFF',
  textMuted:   '#6B7785',
  textSub:     '#9BA3AD',
  accent:      '#4A90D9',
  accentGreen: '#3DBE7A',
  error:       '#E05C5C',
};

const LIGHT_C = {
  bg:          '#F5F7F8',
  surface:     '#FFFFFF',
  border:      '#DDE1E6',
  borderFocus: '#4A90D9',
  text:        '#11181C',
  textMuted:   '#7A8593',
  textSub:     '#5B6472',
  accent:      '#4A90D9',
  accentGreen: '#3DBE7A',
  error:       '#E05C5C',
};

const COMENTARIO_MIN = 10;
const COMENTARIO_MAX = 500;

export default function HelpScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { usuario } = useAuth();

  const [comentario, setComentario] = useState('');
  const [focused, setFocused]       = useState(false);
  const [enviando, setEnviando]     = useState(false);
  const [enviado, setEnviado]       = useState(false);
  const [error, setError]           = useState('');

  // Viajes anteriores del usuario (como pasajero) para reportar al conductor.
  const [viajes, setViajes]               = useState<Reserva[]>([]);
  const [cargandoViajes, setCargandoViajes] = useState(true);
  const [viajeSel, setViajeSel]           = useState<string | null>(null); // viajeId

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const todas = await misReservas();
        const previos = todas
          .filter((r) => r.estado === 'COMPLETADA' || r.estado === 'CONFIRMADA')
          .sort((a, b) => b.fechaHoraSalida.localeCompare(a.fechaHoraSalida));
        if (!cancelado) setViajes(previos);
      } catch {
        // Sin viajes no bloquea el reporte general.
      } finally {
        if (!cancelado) setCargandoViajes(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const fechaCorta = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const longitud = comentario.trim().length;
  const puedeEnviar = longitud >= COMENTARIO_MIN && !enviando;

  const handleEnviar = async () => {
    setError('');
    if (longitud < COMENTARIO_MIN) {
      setError(
        t('help.errorCorto', { n: COMENTARIO_MIN }),
      );
      return;
    }
    setEnviando(true);
    try {
      await crearReporte(comentario.trim(), viajeSel ?? undefined);
      setEnviado(true);
    } catch (e: any) {
      setError(e?.message ?? t('help.errorEnviar'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ width: 36 }} />
      </View>

      {enviado ? (
        <View style={s.successWrap}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark" size={34} color={C.accentGreen} />
          </View>
          <Text style={s.successTitle}>{t('help.graciasTitle')}</Text>
          <Text style={s.successText}>
            {t('help.graciasMsg')}
          </Text>
          <TouchableOpacity style={s.saveBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={s.saveText}>{t('help.volver')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.pageTitle}>{t('help.title')}</Text>
            <Text style={s.pageSub}>
              {t('help.subtitle')}
            </Text>

            {/* Selección de un viaje anterior, como en Uber */}
            <Text style={s.label}>{t('help.viajeLabel')}</Text>
            {cargandoViajes ? (
              <ActivityIndicator color={C.accent} style={{ marginBottom: 20 }} />
            ) : (
              <View style={s.viajesWrap}>
                <TouchableOpacity
                  style={[s.viajeItem, viajeSel === null && s.viajeItemActive]}
                  onPress={() => setViajeSel(null)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={viajeSel === null ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={viajeSel === null ? C.accent : C.textMuted}
                  />
                  <Text style={s.viajeTitulo}>{t('help.sinViaje')}</Text>
                </TouchableOpacity>

                {viajes.map((v) => {
                  const activo = viajeSel === v.viajeId;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[s.viajeItem, activo && s.viajeItemActive]}
                      onPress={() => setViajeSel(v.viajeId)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={activo ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={activo ? C.accent : C.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.viajeTitulo} numberOfLines={1}>
                          {t('help.viajeConConductor', { nombre: v.conductorNombre })}
                        </Text>
                        <Text style={s.viajeMeta} numberOfLines={1}>
                          {fechaCorta(v.fechaHoraSalida)} · {v.origenViaje}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {viajes.length === 0 && <Text style={s.viajeMeta}>{t('help.sinViajesPrevios')}</Text>}
              </View>
            )}

            <Text style={s.label}>{t('help.comentarioLabel')}</Text>
            <TextInput
              style={[s.input, focused && s.inputFocus]}
              value={comentario}
              onChangeText={(v) => {
                setComentario(v);
                setError('');
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={t('help.comentarioPlaceholder')}
              placeholderTextColor={C.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={COMENTARIO_MAX}
            />
            <Text style={s.counter}>{comentario.length}/{COMENTARIO_MAX}</Text>

            {!!error && <Text style={s.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[s.saveBtn, !puedeEnviar && { opacity: 0.6 }]}
              onPress={handleEnviar}
              disabled={!puedeEnviar}
              activeOpacity={0.8}
            >
              {enviando
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={s.saveText}>{t('help.enviar')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
      paddingBottom: 8,
    },
    backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backIcon: { fontSize: 22, color: C.text },

    scroll: { paddingHorizontal: 20, paddingBottom: 40 },

    pageTitle: { fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
    pageSub:   { fontSize: 14, color: C.textSub, marginTop: 6, marginBottom: 28, lineHeight: 20 },

    viajesWrap: { gap: 8, marginBottom: 22 },
    viajeItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    },
    viajeItemActive: { borderColor: C.borderFocus },
    viajeTitulo: { color: C.text, fontSize: 14, fontWeight: '600' },
    viajeMeta: { color: C.textMuted, fontSize: 12, marginTop: 2 },

    label: { fontSize: 13, fontWeight: '600', color: C.textMuted, marginBottom: 8 },
    input: {
      minHeight: 160,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      lineHeight: 21,
      color: C.text,
    },
    inputFocus: { borderColor: C.borderFocus },
    counter: { fontSize: 12, color: C.textMuted, textAlign: 'right', marginTop: 6, marginBottom: 12 },

    errorText: { color: C.error, fontSize: 13, marginBottom: 12, textAlign: 'center' },

    saveBtn: {
      backgroundColor: C.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      alignSelf: 'stretch',
      marginTop: 8,
    },
    saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

    successWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingBottom: 60,
    },
    successIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(61,190,122,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    successTitle: { fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'center' },
    successText:  { fontSize: 14, color: C.textSub, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
  });
}
