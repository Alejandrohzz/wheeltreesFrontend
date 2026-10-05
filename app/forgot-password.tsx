import { useAppTheme } from '@/contexts/ThemeContext';
import { restablecerPassword, solicitarRecuperacion, verificarCodigoRecuperacion } from '@/services/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DARK_C = {
  bg:            '#131517',
  surface:       '#1E2126',
  surfaceAlt:    '#252A30',
  border:        '#2E343C',
  borderFocus:   '#4A90D9',
  text:          '#FFFFFF',
  textMuted:     '#6B7785',
  textSecondary: '#9BA3AD',
  primary:       '#FFFFFF',
  primaryText:   '#131517',
  accent:        '#4A90D9',
  accentGreen:   '#3DBE7A',
  iconMuted:     '#4A5160',
  error:         '#E05C5C',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EDEFF2',
  border: '#DDE1E6',
  borderFocus: '#4A90D9',
  text: '#11181C',
  textMuted: '#7A8593',
  textSecondary: '#5B6472',
  primary: '#131517',
  primaryText: '#FFFFFF',
  accent: '#4A90D9',
  accentGreen: '#3DBE7A',
  iconMuted: '#9099A6',
  error: '#E05C5C',
};

type Step = 'email' | 'otp' | 'password';
type Field = 'email' | 'otp' | 'password' | 'confirm';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [focused, setFocused] = useState<Field | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const field = (key: Field) => ({
    onFocus: () => setFocused(key),
    onBlur: () => setFocused(null),
  });

  // ── Paso 1: pedir el código ───────────────────────────────────────────────
  const handleSolicitar = async () => {
    setError(''); setExito('');
    if (!email.trim()) { setError(t('forgotPassword.errorEmailRequired')); return; }
    if (!email.toLowerCase().endsWith('@unbosque.edu.co')) {
      setError(t('forgotPassword.errorEmailDomain'));
      return;
    }

    setCargando(true);
    try {
      const res = await solicitarRecuperacion(email.trim().toLowerCase());
      setExito(res.mensaje);
      setStep('otp');
    } catch (e: any) {
      setError(e.message ?? t('forgotPassword.errorGeneric'));
    } finally {
      setCargando(false);
    }
  };

  // ── Paso 2: verificar el código ───────────────────────────────────────────
  const handleVerificar = async () => {
    setError(''); setExito('');
    if (otp.length !== 6) { setError(t('forgotPassword.errorOtpLength')); return; }

    setCargando(true);
    try {
      const res = await verificarCodigoRecuperacion(email.trim().toLowerCase(), otp);
      setExito(res.mensaje);
      setStep('password');
    } catch (e: any) {
      setError(e.message ?? t('forgotPassword.errorOtpInvalid'));
    } finally {
      setCargando(false);
    }
  };

  // ── Paso 3: nueva contraseña ──────────────────────────────────────────────
  const handleRestablecer = async () => {
    setError(''); setExito('');
    if (password.length < 8) { setError(t('forgotPassword.errorPasswordLength')); return; }
    if (password !== confirm) { setError(t('forgotPassword.errorPasswordMismatch')); return; }

    setCargando(true);
    try {
      const res = await restablecerPassword(email.trim().toLowerCase(), otp, password);
      setExito(res.mensaje);
      setTimeout(() => router.replace('/login'), 1800);
    } catch (e: any) {
      setError(e.message ?? t('forgotPassword.errorGeneric'));
    } finally {
      setCargando(false);
    }
  };

  // ── Reenviar código (reusa el mismo endpoint de solicitar) ───────────────
  const handleReenviar = async () => {
    setError(''); setExito('');
    setCargando(true);
    try {
      const res = await solicitarRecuperacion(email.trim().toLowerCase());
      setExito(res.mensaje);
    } catch (e: any) {
      setError(e.message ?? t('forgotPassword.errorResend'));
    } finally {
      setCargando(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PASO 3: nueva contraseña
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'password') {
    return (
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.container}>
          <Text style={s.title}>{t('forgotPassword.stepPasswordTitle')}</Text>
          <Text style={s.subtitle}>{t('forgotPassword.stepPasswordSubtitle')}</Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>{t('forgotPassword.newPasswordLabel')}</Text>
            <View style={[s.inputWrap, focused === 'password' && s.inputWrapFocus]}>
              <Text style={s.icon}>◉</Text>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder={t('forgotPassword.newPasswordPlaceholder')}
                placeholderTextColor={C.iconMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                returnKeyType="next"
                {...field('password')}
              />
              <Pressable onPress={() => setShowPassword((p) => !p)} hitSlop={8}>
                <Text style={s.icon}>{showPassword ? '◎' : '⊗'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>{t('forgotPassword.confirmPasswordLabel')}</Text>
            <View style={[s.inputWrap, focused === 'confirm' && s.inputWrapFocus]}>
              <Text style={s.icon}>◉</Text>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
                placeholderTextColor={C.iconMuted}
                secureTextEntry={!showConfirm}
                value={confirm}
                onChangeText={setConfirm}
                returnKeyType="done"
                onSubmitEditing={handleRestablecer}
                {...field('confirm')}
              />
              <Pressable onPress={() => setShowConfirm((p) => !p)} hitSlop={8}>
                <Text style={s.icon}>{showConfirm ? '◎' : '⊗'}</Text>
              </Pressable>
            </View>
          </View>

          {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
          {!!exito && <View style={s.exitoBox}><Text style={s.exitoText}>{exito}</Text></View>}

          <TouchableOpacity
            style={[s.actionBtn, cargando && s.btnDisabled]}
            activeOpacity={0.88}
            onPress={handleRestablecer}
            disabled={cargando}
          >
            {cargando
              ? <ActivityIndicator color={C.primaryText} />
              : <Text style={s.actionBtnText}>{t('forgotPassword.restablecerButton')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASO 2: código OTP
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.container}>
          <Text style={s.title}>{t('forgotPassword.stepOtpTitle')}</Text>
          <Text style={s.subtitle}>
            {t('forgotPassword.otpSubtitle')}{'\n'}
            <Text style={{ color: C.accent }}>{email}</Text>
          </Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>{t('forgotPassword.otpLabel')}</Text>
            <View style={[s.inputWrap, focused === 'otp' && s.inputWrapFocus]}>
              <Ionicons name="key-outline" size={18} color={C.accentGreen} style={s.iconVec} />
              <TextInput
                style={[s.input, { letterSpacing: 6, fontSize: 20, fontWeight: '700' }]}
                placeholder="123456"
                placeholderTextColor={C.iconMuted}
                keyboardType="numeric"
                maxLength={6}
                returnKeyType="done"
                value={otp}
                onChangeText={setOtp}
                onSubmitEditing={handleVerificar}
                {...field('otp')}
              />
            </View>
          </View>

          {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
          {!!exito && <View style={s.exitoBox}><Text style={s.exitoText}>{exito}</Text></View>}

          <TouchableOpacity
            style={[s.actionBtn, cargando && s.btnDisabled]}
            activeOpacity={0.88}
            onPress={handleVerificar}
            disabled={cargando}
          >
            {cargando
              ? <ActivityIndicator color={C.primaryText} />
              : <Text style={s.actionBtnText}>{t('forgotPassword.verifyButton')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.reenviarBtn} onPress={handleReenviar} disabled={cargando}>
            <Text style={s.reenviarText}>{t('forgotPassword.resendPrompt')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASO 1: pedir el correo
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{t('forgotPassword.stepEmailTitle')}</Text>
        <Text style={s.subtitle}>{t('forgotPassword.stepEmailSubtitle')}</Text>

        <View style={s.fieldGroup}>
          <Text style={s.label}>{t('forgotPassword.emailLabel')}</Text>
          <View style={[s.inputWrap, focused === 'email' && s.inputWrapFocus]}>
            <Text style={s.icon}>@</Text>
            <TextInput
              style={s.input}
              placeholder="usuario@unbosque.edu.co"
              placeholderTextColor={C.iconMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="done"
              onSubmitEditing={handleSolicitar}
              {...field('email')}
            />
          </View>
        </View>

        {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
        {!!exito && <View style={s.exitoBox}><Text style={s.exitoText}>{exito}</Text></View>}

        <TouchableOpacity
          style={[s.actionBtn, cargando && s.btnDisabled]}
          activeOpacity={0.88}
          onPress={handleSolicitar}
          disabled={cargando}
        >
          {cargando
            ? <ActivityIndicator color={C.primaryText} />
            : <Text style={s.actionBtnText}>{t('forgotPassword.solicitarButton')}</Text>}
        </TouchableOpacity>

        <View style={s.footer}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.footerLink}>{t('forgotPassword.backToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
    flex:      { flex: 1, backgroundColor: C.bg },
    container: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 100, paddingBottom: 40 },
    title: { fontSize: 26, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
    subtitle: { fontSize: 14, color: C.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
    fieldGroup: { marginBottom: 18 },
    label: { fontSize: 13, fontWeight: '500', color: C.textSecondary, marginBottom: 8 },
    inputWrap: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 4,
    },
    inputWrapFocus: { borderColor: C.borderFocus, backgroundColor: C.surfaceAlt },
    icon:  { fontSize: 18, color: C.iconMuted, marginRight: 10, width: 22, textAlign: 'center' },
    iconVec: { marginRight: 10, width: 22, textAlign: 'center' },
    input: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 0 },
    errorBox: { backgroundColor: '#3D1A1A', borderRadius: 10, padding: 12, marginBottom: 16 },
    errorText: { color: C.error, fontSize: 13 },
    exitoBox: { backgroundColor: '#1A2E1A', borderRadius: 10, padding: 12, marginBottom: 16 },
    exitoText: { color: C.accentGreen, fontSize: 13 },
    actionBtn: { backgroundColor: C.primary, paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 8 },
    btnDisabled: { opacity: 0.6 },
    actionBtnText: { color: C.primaryText, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
    reenviarBtn: { marginTop: 20, alignItems: 'center' },
    reenviarText: { color: C.accent, fontSize: 13 },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
    footerLink: { fontSize: 14, fontWeight: '600', color: C.accent },
  });
}