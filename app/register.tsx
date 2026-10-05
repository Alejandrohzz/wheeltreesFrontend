import { useAppTheme } from '@/contexts/ThemeContext';
import { construirEmailDesdeUsuario, DOMINIO_CORREO, reenviarOtp, registro, verificarEmail } from '@/services/auth';
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

type Field = 'nombre' | 'apellido' | 'email' | 'password' | 'confirm' | 'otp';
type Step   = 'form' | 'otp';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();

  // ── Paso 1: formulario ────────────────────────────────────────────────────
  const [nombre,       setNombre]       = useState('');
  const [apellido,     setApellido]     = useState('');
  // Solo la primera parte del correo (antes de la @). El dominio se agrega solo.
  const [usuario,      setUsuario]      = useState('');
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  // ── Paso 2: OTP ───────────────────────────────────────────────────────────
  const [otp, setOtp] = useState('');

  // ── Estado general ────────────────────────────────────────────────────────
  const [step,     setStep]     = useState<Step>('form');
  const [focused,  setFocused]  = useState<Field | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState('');
  const [exito,    setExito]    = useState('');

  // Correo completo que se envía al backend (usuario + dominio institucional).
  const emailCompleto = construirEmailDesdeUsuario(usuario).trim().toLowerCase();

  // Si pegan el correo completo, se queda solo con lo que va antes de la @.
  const handleUsuarioChange = (v: string) => {
    setUsuario(v.split('@')[0].replace(/\s/g, ''));
  };

  // ── Validación básica ─────────────────────────────────────────────────────
  const validarFormulario = () => {
    if (!nombre.trim())   return t('register.errorNombreRequired');
    if (!apellido.trim()) return t('register.errorApellidoRequired');
    if (!usuario.trim())  return t('register.errorEmailRequired');
    if (password.length < 8)
      return t('register.errorPasswordLength');
    if (password !== confirm)
      return t('register.errorPasswordMismatch');
    return null;
  };

  // ── Registro ──────────────────────────────────────────────────────────────
  const handleRegistro = async () => {
    setError(''); setExito('');
    const err = validarFormulario();
    if (err) { setError(err); return; }

    setCargando(true);
    try {
      const res = await registro({
        nombre:   nombre.trim(),
        apellido: apellido.trim(),
        email:    emailCompleto,
        password,
        // Todos los usuarios inician como pasajero; el rol se cambia luego desde el perfil.
        rol: 'PASAJERO',
      });
      setExito(res.mensaje);
      setStep('otp');
    } catch (e: any) {
      setError(e.message ?? t('register.errorGeneric'));
    } finally {
      setCargando(false);
    }
  };

  // ── Verificar OTP ─────────────────────────────────────────────────────────
  const handleVerificar = async () => {
    setError(''); setExito('');
    if (otp.length !== 6) { setError(t('register.errorOtpLength')); return; }

    setCargando(true);
    try {
      const res = await verificarEmail({ email: emailCompleto, codigoOtp: otp });
      setExito(res.mensaje);
      // Espera un momento y navega al login
      setTimeout(() => router.replace('/login'), 1800);
    } catch (e: any) {
      setError(e.message ?? t('register.errorOtpInvalid'));
    } finally {
      setCargando(false);
    }
  };

  // ── Reenviar OTP ──────────────────────────────────────────────────────────
  const handleReenviar = async () => {
    setError(''); setExito('');
    setCargando(true);
    try {
      const res = await reenviarOtp(emailCompleto);
      setExito(res.mensaje);
    } catch (e: any) {
      setError(e.message ?? t('register.errorResend'));
    } finally {
      setCargando(false);
    }
  };

  // ── UI helpers ────────────────────────────────────────────────────────────
  const field = (key: Field) => ({
    onFocus: () => setFocused(key),
    onBlur:  () => setFocused(null),
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PASO 2: verificación OTP
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.container}>
          <Text style={s.title}>{t('register.stepOtpTitle')}</Text>
          <Text style={s.subtitle}>
            {t('register.otpSubtitle')}{'\n'}
            <Text style={{ color: C.accent }}>{emailCompleto}</Text>
          </Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>{t('register.otpLabel')}</Text>
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
                {...field('otp')}
              />
            </View>
          </View>

          {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
          {!!exito && <View style={s.exitoBox}><Text style={s.exitoText}>{exito}</Text></View>}

          <TouchableOpacity
            style={[s.registerBtn, cargando && s.btnDisabled]}
            activeOpacity={0.88}
            onPress={handleVerificar}
            disabled={cargando}
          >
            {cargando
              ? <ActivityIndicator color={C.primaryText} />
              : <Text style={s.registerBtnText}>{t('register.verifyButton')}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.reenviarBtn} onPress={handleReenviar} disabled={cargando}>
            <Text style={s.reenviarText}>{t('register.resendPrompt')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASO 1: formulario de registro
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

        <Text style={s.title}>{t('register.stepFormTitle')}</Text>

        {/* Nombre */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t('register.nombreLabel')}</Text>
          <View style={[s.inputWrap, focused === 'nombre' && s.inputWrapFocus]}>
            <Ionicons name="person-outline" size={18} color={C.accentGreen} style={s.iconVec} />
            <TextInput style={s.input} placeholder={t('register.nombrePlaceholder')} placeholderTextColor={C.iconMuted}
              autoCapitalize="words" value={nombre} onChangeText={setNombre} returnKeyType="next"
              {...field('nombre')} />
          </View>
        </View>

        {/* Apellido */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t('register.apellidoLabel')}</Text>
          <View style={[s.inputWrap, focused === 'apellido' && s.inputWrapFocus]}>
            <Ionicons name="person-outline" size={18} color={C.accentGreen} style={s.iconVec} />
            <TextInput style={s.input} placeholder={t('register.apellidoPlaceholder')} placeholderTextColor={C.iconMuted}
              autoCapitalize="words" value={apellido} onChangeText={setApellido} returnKeyType="next"
              {...field('apellido')} />
          </View>
        </View>

        {/* Correo: solo la primera parte, el dominio se muestra fijo */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t('register.emailLabel')}</Text>
          <View style={[s.inputWrap, focused === 'email' && s.inputWrapFocus]}>
            <Text style={s.icon}>@</Text>
            <TextInput style={s.input} placeholder={t('login.usernamePlaceholder')}
              placeholderTextColor={C.iconMuted} autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" value={usuario} onChangeText={handleUsuarioChange} returnKeyType="next"
              {...field('email')} />
            <Text style={s.dominio}>{DOMINIO_CORREO}</Text>
          </View>
        </View>

        {/* Password */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t('register.passwordLabel')}</Text>
          <View style={[s.inputWrap, focused === 'password' && s.inputWrapFocus]}>
            <Text style={s.icon}>◉</Text>
            <TextInput style={[s.input, { flex: 1 }]} placeholder={t('register.passwordPlaceholder')}
              placeholderTextColor={C.iconMuted} secureTextEntry={!showPassword}
              value={password} onChangeText={setPassword} returnKeyType="next"
              {...field('password')} />
            <Pressable onPress={() => setShowPassword(p => !p)} hitSlop={8}>
              <Text style={s.icon}>{showPassword ? '◎' : '⊗'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Confirm Password */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>{t('register.confirmPasswordLabel')}</Text>
          <View style={[s.inputWrap, focused === 'confirm' && s.inputWrapFocus]}>
            <Text style={s.icon}>◉</Text>
            <TextInput style={[s.input, { flex: 1 }]} placeholder={t('register.confirmPasswordPlaceholder')}
              placeholderTextColor={C.iconMuted} secureTextEntry={!showConfirm}
              value={confirm} onChangeText={setConfirm} returnKeyType="done"
              onSubmitEditing={handleRegistro}
              {...field('confirm')} />
            <Pressable onPress={() => setShowConfirm(p => !p)} hitSlop={8}>
              <Text style={s.icon}>{showConfirm ? '◎' : '⊗'}</Text>
            </Pressable>
          </View>
        </View>

        {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}

        <TouchableOpacity
          style={[s.registerBtn, cargando && s.btnDisabled]}
          activeOpacity={0.88}
          onPress={handleRegistro}
          disabled={cargando}
        >
          {cargando
            ? <ActivityIndicator color={C.primaryText} />
            : <Text style={s.registerBtnText}>{t('register.submitButton')}</Text>
          }
        </TouchableOpacity>

        <View style={s.footer}>
          <Text style={s.footerText}>{t('register.haveAccount')}</Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={s.footerLink}>{t('register.loginLink')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  flex:      { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: C.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  fieldGroup:     { marginBottom: 18 },
  label:          { fontSize: 13, fontWeight: '500', color: C.textSecondary, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 4,
  },
  inputWrapFocus: { borderColor: C.borderFocus, backgroundColor: C.surfaceAlt },
  icon:    { fontSize: 18, color: C.iconMuted, marginRight: 10, width: 22, textAlign: 'center' },
  iconVec: { marginRight: 10, width: 22, textAlign: 'center' },
  input:   { flex: 1, fontSize: 15, color: C.text, paddingVertical: 0 },
  dominio: { fontSize: 13, color: C.textMuted, marginLeft: 6 },
  errorBox: { backgroundColor: '#3D1A1A', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: C.error, fontSize: 13 },
  exitoBox:  { backgroundColor: '#1A2E1A', borderRadius: 10, padding: 12, marginBottom: 16 },
  exitoText: { color: C.accentGreen, fontSize: 13 },
  registerBtn:     { backgroundColor: C.primary, paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 8 },
  btnDisabled:     { opacity: 0.6 },
  registerBtnText: { color: C.primaryText, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  reenviarBtn: { marginTop: 20, alignItems: 'center' },
  reenviarText: { color: C.accent, fontSize: 13 },
  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14, color: C.textMuted },
  footerLink: { fontSize: 14, fontWeight: '600', color: C.accent },
});
}