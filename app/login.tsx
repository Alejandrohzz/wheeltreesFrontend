import { useAppTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { construirEmailDesdeUsuario, DOMINIO_CORREO, extraerUsuarioDeEmail } from '@/services/auth';
import { guardarUltimoUsuario, obtenerUltimoUsuario } from '@/services/biometrics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
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

export default function LoginScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const {
    usuario: sesionActiva,
    cargando: cargandoSesion,
    iniciarSesion,
    iniciarSesionConBiometria,
    biometricDisponible,
    biometricActivada,
    haySesionGuardada,
    habilitarBiometria,
  } = useAuth();

  const [usuario,      setUsuario]      = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused,      setFocused]      = useState<'usuario' | 'password' | null>(null);
  const [cargando,     setCargando]     = useState(false);
  const [verificandoBiometria, setVerificandoBiometria] = useState(false);
  const [error,        setError]        = useState('');

  const mostrarBotonBiometrico = biometricDisponible && biometricActivada && haySesionGuardada;
  const intentoAutomaticoHecho = useRef(false);

  // Prellena el campo con el último usuario que inició sesión en este equipo.
  useEffect(() => {
    obtenerUltimoUsuario().then((u) => {
      if (u) setUsuario(u);
    });
  }, []);

  // Si ya hay una sesión activa (se retomó sola porque la biometría no
  // estaba protegiéndola) o se abre luego de desbloquear, entra directo.
  useEffect(() => {
    if (!cargandoSesion && sesionActiva) {
      router.replace('/home');
    }
  }, [cargandoSesion, sesionActiva, router]);

  // Al llegar a esta pantalla con biometría disponible y una sesión guardada,
  // lanza el prompt de huella/rostro automáticamente una sola vez, como
  // hacen Nequi o Davivienda al abrir la app.
  useEffect(() => {
    if (
      !cargandoSesion &&
      mostrarBotonBiometrico &&
      !sesionActiva &&
      !intentoAutomaticoHecho.current
    ) {
      intentoAutomaticoHecho.current = true;
      handleBiometria();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargandoSesion, mostrarBotonBiometrico, sesionActiva]);

  const handleBiometria = async () => {
    setError('');
    setVerificandoBiometria(true);
    try {
      const ok = await iniciarSesionConBiometria();
      if (ok) {
        router.replace('/home');
      } else {
        setError('No se pudo verificar tu identidad. Intenta Face ID/huella o usa el código del iPhone como respaldo.');
      }
    } finally {
      setVerificandoBiometria(false);
    }
  };

  const handleLogin = async () => {
    setError('');

    if (!usuario.trim()) {
      setError('El usuario es obligatorio');
      return;
    }
    if (!password) {
      setError('La contraseña es obligatoria');
      return;
    }

    setCargando(true);
    try {
      const email = construirEmailDesdeUsuario(usuario);
      await iniciarSesion({ email, password });
      await guardarUltimoUsuario(extraerUsuarioDeEmail(email));

      // Si el dispositivo soporta biometría y el usuario aún no la activó,
      // se le ofrece activarla para no tener que escribir la contraseña
      // la próxima vez que abra la app.
      if (biometricDisponible && !biometricActivada) {
        Alert.alert(
          'Inicio de sesión biométrico',
          '¿Quieres usar tu huella o Face ID para iniciar sesión la próxima vez?',
          [
            { text: 'Ahora no', style: 'cancel', onPress: () => router.replace('/home') },
            {
              text: 'Activar',
              onPress: async () => {
                await habilitarBiometria();
                router.replace('/home');
              },
            },
          ],
        );
      } else {
        router.replace('/home');
      }
    } catch (err: any) {
      setError(err.message ?? 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.container}>

        <Text style={s.title}>Sign In</Text>

        {/* Usuario */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Usuario</Text>
          <View style={[s.inputWrap, focused === 'usuario' && s.inputWrapFocus]}>
            <Text style={s.icon}>@</Text>
            <TextInput
              style={s.input}
              placeholder="usuario"
              placeholderTextColor={C.iconMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              value={usuario}
              onChangeText={setUsuario}
              onFocus={() => setFocused('usuario')}
              onBlur={() => setFocused(null)}
            />
            <Text style={s.dominio}>{DOMINIO_CORREO}</Text>
          </View>
        </View>

        {/* Password */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Password</Text>
          <View style={[s.inputWrap, focused === 'password' && s.inputWrapFocus]}>
            <Text style={s.icon}>◉</Text>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={C.iconMuted}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              onSubmitEditing={handleLogin}
            />
            <Pressable onPress={() => setShowPassword(p => !p)} hitSlop={8}>
              <Text style={s.icon}>{showPassword ? '◎' : '⊗'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Error message */}
        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠ {error}</Text>
          </View>
        )}

        {/* Sign In button */}
        <TouchableOpacity
          style={[s.signInBtn, cargando && s.signInBtnDisabled]}
          activeOpacity={0.88}
          onPress={handleLogin}
          disabled={cargando}
        >
          {cargando
            ? <ActivityIndicator color={C.primaryText} />
            : <Text style={s.signInBtnText}>Sign In</Text>
          }
        </TouchableOpacity>

        {/* Biometría se solicita automáticamente al abrir la app. Este botón queda como reintento. */}
        {mostrarBotonBiometrico && (
          <TouchableOpacity
            style={[s.bioBtn, verificandoBiometria && s.signInBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleBiometria}
            disabled={verificandoBiometria}
          >
            {verificandoBiometria ? (
              <ActivityIndicator color={C.accentGreen} />
            ) : (
              <>
                <Text style={s.bioIcon}>🔒</Text>
                <Text style={s.bioBtnText}>Ingresar con biometría</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={s.footer}>
          <Text style={s.footerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={s.footerLink}>Regístrate</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  flex:      { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 80 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: -0.3,
  },
  fieldGroup:     { marginBottom: 18 },
  label:          { fontSize: 13, fontWeight: '500', color: C.textSecondary, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 4,
  },
  inputWrapFocus:   { borderColor: C.borderFocus, backgroundColor: C.surfaceAlt },
  icon:             { fontSize: 18, color: C.iconMuted, marginRight: 10, width: 22, textAlign: 'center' },
  input:            { flex: 1, fontSize: 15, color: C.text, paddingVertical: 0 },
  dominio:          { fontSize: 13, color: C.textMuted, marginLeft: 6 },
  errorBox:         { backgroundColor: '#3D1A1A', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:        { color: C.error, fontSize: 13 },
  signInBtn:        { backgroundColor: C.primary, paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 8 },
  signInBtnDisabled:{ opacity: 0.6 },
  signInBtnText:    { color: C.primaryText, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.accentGreen,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 14,
  },
  bioIcon:          { fontSize: 16, marginRight: 8 },
  bioBtnText:       { color: C.accentGreen, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  footer:           { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText:       { fontSize: 14, color: C.textMuted },
  footerLink:       { fontSize: 14, fontWeight: '600', color: C.accent },
});
}
