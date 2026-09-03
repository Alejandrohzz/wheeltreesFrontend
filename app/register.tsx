import { reenviarOtp, registro, verificarEmail } from '@/services/auth';
import { RolUsuario } from '@/services/types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

const C = {
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

type Field = 'nombre' | 'apellido' | 'email' | 'password' | 'confirm' | 'otp';
type Step   = 'form' | 'otp';

export default function RegisterScreen() {
  const router = useRouter();

  // ── Paso 1: formulario ────────────────────────────────────────────────────
  const [nombre,       setNombre]       = useState('');
  const [apellido,     setApellido]     = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [rol,          setRol]          = useState<RolUsuario>('PASAJERO');
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

  // ── Validación básica ─────────────────────────────────────────────────────
  const validarFormulario = () => {
    if (!nombre.trim())   return 'El nombre es obligatorio';
    if (!apellido.trim()) return 'El apellido es obligatorio';
    if (!email.trim())    return 'El email es obligatorio';
    if (!email.toLowerCase().endsWith('@unbosque.edu.co'))
      return 'Solo se permiten correos @unbosque.edu.co';
    if (password.length < 8)
      return 'La contraseña debe tener mínimo 8 caracteres';
    if (password !== confirm)
      return 'Las contraseñas no coinciden';
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
        email:    email.trim().toLowerCase(),
        password,
        rol,
      });
      setExito(res.mensaje);
      setStep('otp');
    } catch (e: any) {
      setError(e.message ?? 'Error al registrarse');
    } finally {
      setCargando(false);
    }
  };

  // ── Verificar OTP ─────────────────────────────────────────────────────────
  const handleVerificar = async () => {
    setError(''); setExito('');
    if (otp.length !== 6) { setError('El código debe tener 6 dígitos'); return; }

    setCargando(true);
    try {
      const res = await verificarEmail({ email: email.trim().toLowerCase(), codigoOtp: otp });
      setExito(res.mensaje);
      // Espera un momento y navega al login
      setTimeout(() => router.replace('/login'), 1800);
    } catch (e: any) {
      setError(e.message ?? 'Código inválido o expirado');
    } finally {
      setCargando(false);
    }
  };

  // ── Reenviar OTP ──────────────────────────────────────────────────────────
  const handleReenviar = async () => {
    setError(''); setExito('');
    setCargando(true);
    try {
      const res = await reenviarOtp(email.trim().toLowerCase());
      setExito(res.mensaje);
    } catch (e: any) {
      setError(e.message ?? 'Error al reenviar el código');
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
          <Text style={s.title}>Verifica tu correo</Text>
          <Text style={s.subtitle}>
            Ingresa el código de 6 dígitos que enviamos a{'\n'}
            <Text style={{ color: C.accent }}>{email}</Text>
          </Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Código OTP</Text>
            <View style={[s.inputWrap, focused === 'otp' && s.inputWrapFocus]}>
              <Text style={s.icon}></Text>
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

          {!!error && <View style={s.errorBox}><Text style={s.errorText}>⚠ {error}</Text></View>}
          {!!exito && <View style={s.exitoBox}><Text style={s.exitoText}>✓ {exito}</Text></View>}

          <TouchableOpacity
            style={[s.registerBtn, cargando && s.btnDisabled]}
            activeOpacity={0.88}
            onPress={handleVerificar}
            disabled={cargando}
          >
            {cargando
              ? <ActivityIndicator color={C.primaryText} />
              : <Text style={s.registerBtnText}>Verificar cuenta</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.reenviarBtn} onPress={handleReenviar} disabled={cargando}>
            <Text style={s.reenviarText}>¿No recibiste el código? Reenviar</Text>
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

        <Text style={s.title}>Create Account</Text>

        {/* Nombre */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Nombre</Text>
          <View style={[s.inputWrap, focused === 'nombre' && s.inputWrapFocus]}>
            <Text style={s.icon}>⊙</Text>
            <TextInput style={s.input} placeholder="Nombre" placeholderTextColor={C.iconMuted}
              autoCapitalize="words" value={nombre} onChangeText={setNombre} returnKeyType="next"
              {...field('nombre')} />
          </View>
        </View>

        {/* Apellido */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Apellido</Text>
          <View style={[s.inputWrap, focused === 'apellido' && s.inputWrapFocus]}>
            <Text style={s.icon}>⊙</Text>
            <TextInput style={s.input} placeholder="Apellido" placeholderTextColor={C.iconMuted}
              autoCapitalize="words" value={apellido} onChangeText={setApellido} returnKeyType="next"
              {...field('apellido')} />
          </View>
        </View>

        {/* Email */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Email institucional</Text>
          <View style={[s.inputWrap, focused === 'email' && s.inputWrapFocus]}>
            <Text style={s.icon}>@</Text>
            <TextInput style={s.input} placeholder="usuario@unbosque.edu.co"
              placeholderTextColor={C.iconMuted} autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" value={email} onChangeText={setEmail} returnKeyType="next"
              {...field('email')} />
          </View>
        </View>

        {/* Rol */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Rol</Text>
          <View style={s.rolRow}>
            {(['PASAJERO', 'CONDUCTOR'] as RolUsuario[]).map(r => (
              <TouchableOpacity
                key={r}
                style={[s.rolBtn, rol === r && s.rolBtnActive]}
                onPress={() => setRol(r)}
              >
                <Text style={[s.rolBtnText, rol === r && s.rolBtnTextActive]}>
                  {r === 'PASAJERO' ? 'Pasajero' : 'Conductor'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.rolHelp}>
            Podrás cambiar entre pasajero y conductor cuando quieras desde tu perfil.
          </Text>
        </View>

        {/* Password */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Password</Text>
          <View style={[s.inputWrap, focused === 'password' && s.inputWrapFocus]}>
            <Text style={s.icon}>◉</Text>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="Mínimo 8 caracteres"
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
          <Text style={s.label}>Confirm Password</Text>
          <View style={[s.inputWrap, focused === 'confirm' && s.inputWrapFocus]}>
            <Text style={s.icon}>◉</Text>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="Repite la contraseña"
              placeholderTextColor={C.iconMuted} secureTextEntry={!showConfirm}
              value={confirm} onChangeText={setConfirm} returnKeyType="done"
              onSubmitEditing={handleRegistro}
              {...field('confirm')} />
            <Pressable onPress={() => setShowConfirm(p => !p)} hitSlop={8}>
              <Text style={s.icon}>{showConfirm ? '◎' : '⊗'}</Text>
            </Pressable>
          </View>
        </View>

        {!!error && <View style={s.errorBox}><Text style={s.errorText}>⚠ {error}</Text></View>}

        <TouchableOpacity
          style={[s.registerBtn, cargando && s.btnDisabled]}
          activeOpacity={0.88}
          onPress={handleRegistro}
          disabled={cargando}
        >
          {cargando
            ? <ActivityIndicator color={C.primaryText} />
            : <Text style={s.registerBtnText}>Create Account</Text>
          }
        </TouchableOpacity>

        <View style={s.footer}>
          <Text style={s.footerText}>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text style={s.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
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
  input:   { flex: 1, fontSize: 15, color: C.text, paddingVertical: 0 },
  rolRow:  { flexDirection: 'row', gap: 10 },
  rolBtn:  { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', backgroundColor: C.surface },
  rolBtnActive: { borderColor: C.accentGreen, backgroundColor: '#1A2E22' },
  rolBtnText:   { color: C.textMuted, fontSize: 14, fontWeight: '500' },
  rolBtnTextActive: { color: C.accentGreen },
  rolHelp: { color: C.textMuted, fontSize: 12, marginTop: 8 },
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
