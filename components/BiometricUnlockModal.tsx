import {
  construirEmailDesdeUsuario,
  solicitarDesbloqueoBiometrico,
  verificarDesbloqueoBiometrico,
} from '@/services/auth';
import { reiniciarIntentosBiometricos } from '@/services/biometrics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const SEGUNDOS_REENVIO = 30;

interface Props {
  visible: boolean;
  /** Usuario (sin dominio) al que se le envía el código. */
  usuario: string;
  /** Paleta de la pantalla de login. */
  C: any;
  onClose: () => void;
  /** Se llama cuando el código fue válido y los intentos ya se reiniciaron. */
  onUnlocked: () => void;
}

/**
 * UR-002: tras 3 intentos biométricos fallidos, el usuario desbloquea la
 * biometría con un código que se envía a su correo institucional.
 */
export default function BiometricUnlockModal({ visible, usuario, C, onClose, onUnlocked }: Props) {
  const { t } = useTranslation();
  const s = useMemo(() => createStyles(C), [C]);
  const email = construirEmailDesdeUsuario(usuario);

  const [enviando, setEnviando]     = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [enviado, setEnviado]       = useState(false);
  const [codigo, setCodigo]         = useState('');
  const [error, setError]           = useState('');
  const [espera, setEspera]         = useState(0);

  const enviarCodigo = useCallback(async () => {
    setError('');
    setEnviando(true);
    try {
      await solicitarDesbloqueoBiometrico(email);
      setEnviado(true);
      setEspera(SEGUNDOS_REENVIO);
    } catch (e: any) {
      setError(e?.message ?? t('biometricUnlock.errorEnviar'));
    } finally {
      setEnviando(false);
    }
  }, [email, t]);

  // Al abrir el modal se envía el código automáticamente.
  useEffect(() => {
    if (!visible) return;
    setCodigo('');
    setEnviado(false);
    setError('');
    enviarCodigo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Cuenta regresiva para poder reenviar.
  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  const verificar = async () => {
    setError('');
    setVerificando(true);
    try {
      await verificarDesbloqueoBiometrico(email, codigo);
      await reiniciarIntentosBiometricos();
      onUnlocked();
    } catch (e: any) {
      setError(e?.message ?? t('biometricUnlock.errorCodigo'));
    } finally {
      setVerificando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.overlay}
      >
        <View style={s.card}>
          <Text style={s.title}>{t('biometricUnlock.title')}</Text>
          <Text style={s.sub}>
            {enviando
              ? t('biometricUnlock.enviando')
              : enviado
              ? t('biometricUnlock.enviado', { email })
              : t('biometricUnlock.sinEnviar')}
          </Text>

          {enviando && <ActivityIndicator color={C.accentGreen} style={{ marginBottom: 12 }} />}

          <TextInput
            value={codigo}
            onChangeText={(v) => {
              setCodigo(v.replace(/[^0-9]/g, '').slice(0, 6));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={C.iconMuted}
            style={[s.codigoInput, !!error && s.codigoInputError]}
            editable={enviado && !verificando}
          />

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.confirmBtn, (codigo.length < 6 || verificando) && s.disabled]}
            activeOpacity={0.85}
            disabled={codigo.length < 6 || verificando}
            onPress={verificar}
          >
            {verificando ? (
              <ActivityIndicator color={C.primaryText} />
            ) : (
              <Text style={s.confirmText}>{t('biometricUnlock.desbloquear')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.linkBtn}
            activeOpacity={0.7}
            disabled={enviando || espera > 0}
            onPress={enviarCodigo}
          >
            <Text style={[s.linkText, (enviando || espera > 0) && { opacity: 0.5 }]}>
              {espera > 0
                ? t('biometricUnlock.reenviarEn', { s: espera })
                : t('biometricUnlock.reenviar')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.linkBtn} activeOpacity={0.7} onPress={onClose}>
            <Text style={s.cancelText}>{t('biometricUnlock.cancelar')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    card: {
      width: '100%', maxWidth: 380, backgroundColor: C.surface, borderRadius: 20,
      borderWidth: 1, borderColor: C.border, padding: 22, alignItems: 'center',
    },
    title: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' },
    sub: {
      fontSize: 13, color: C.textSecondary, textAlign: 'center',
      marginTop: 8, marginBottom: 18, lineHeight: 19,
    },
    codigoInput: {
      width: 220, borderWidth: 1, borderColor: C.border, borderRadius: 12,
      paddingVertical: 12, textAlign: 'center', fontSize: 26, fontWeight: '800',
      letterSpacing: 8, color: C.text, backgroundColor: C.bg,
    },
    codigoInputError: { borderColor: C.error },
    error: { color: C.error, fontSize: 12, marginTop: 10, textAlign: 'center' },
    confirmBtn: {
      width: '100%', backgroundColor: C.primary, borderRadius: 30,
      paddingVertical: 14, alignItems: 'center', marginTop: 18,
    },
    confirmText: { color: C.primaryText, fontWeight: '700', fontSize: 15 },
    disabled: { opacity: 0.5 },
    linkBtn: { paddingVertical: 10 },
    linkText: { color: C.accent, fontSize: 13, fontWeight: '600' },
    cancelText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  });
}
