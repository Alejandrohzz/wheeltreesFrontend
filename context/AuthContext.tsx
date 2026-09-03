import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearToken, getToken, saveToken } from '@/services/api';
import { login as apiLogin, LoginRequest, UsuarioResponse } from '@/services/auth';
import { obtenerMiPerfil } from '@/services/usuarios';
import {
  autenticarConBiometria,
  biometriaActivada,
  biometriaDisponible,
  setBiometriaActivada,
} from '@/services/biometrics';

// ── Tipos del contexto ────────────────────────────────────────────────────────

interface AuthContextValue {
  usuario:      UsuarioResponse | null;
  token:        string | null;
  cargando:     boolean;

  /** Hay un token guardado en este dispositivo (sesión previa) esperando ser retomada. */
  haySesionGuardada:    boolean;
  /** El dispositivo tiene sensor biométrico configurado (huella/rostro). */
  biometricDisponible:  boolean;
  /** El usuario activó el inicio de sesión biométrico para esta app. */
  biometricActivada:    boolean;

  /** Inicia sesión con email/password y guarda el token. Lanza error si falla. */
  iniciarSesion:          (creds: LoginRequest) => Promise<void>;
  /** Cierra sesión y limpia el token (conserva la preferencia de biometría). */
  cerrarSesion:           () => Promise<void>;
  /** Pide Face ID/huella y, si es correcto, retoma la sesión guardada en el dispositivo. */
  iniciarSesionConBiometria: () => Promise<boolean>;
  /** Activa el login biométrico (pide confirmación biométrica primero). */
  habilitarBiometria:     () => Promise<boolean>;
  /** Desactiva el login biométrico para esta app. */
  deshabilitarBiometria:  () => Promise<void>;
  /** Actualiza en memoria los datos del usuario en sesión (ej. tras cambiar de rol). */
  actualizarUsuarioLocal: (cambios: Partial<UsuarioResponse>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario,  setUsuario]  = useState<UsuarioResponse | null>(null);
  const [token,    setToken]    = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [haySesionGuardada, setHaySesionGuardada]        = useState(false);
  const [biometricDisponible, setBiometricDisponible]   = useState(false);
  const [biometricActivada, setBiometricActivadaEstado] = useState(false);

  /** Con un token ya guardado, trae el perfil real del backend y abre la sesión. */
  const hidratarUsuario = useCallback(async (accessToken: string) => {
    try {
      const perfil = await obtenerMiPerfil();
      setToken(accessToken);
      setUsuario(perfil);
      setHaySesionGuardada(true);
      return true;
    } catch {
      // El token guardado ya expiró o el backend lo rechazó: limpia todo
      // y deja que el usuario inicie sesión de nuevo con su contraseña.
      await clearToken();
      setToken(null);
      setUsuario(null);
      setHaySesionGuardada(false);
      return false;
    }
  }, []);

  // Al arrancar la app: si hay una sesión guardada y la biometría está
  // activada, NO abrimos la sesión directamente. Login solicitará primero
  // Face ID/huella y solo después permitirá el código del dispositivo como
  // respaldo.
  useEffect(() => {
    (async () => {
      try {
        const [saved, disponible, activada] = await Promise.all([
          getToken(),
          biometriaDisponible(),
          biometriaActivada(),
        ]);

        setBiometricDisponible(disponible);
        setBiometricActivadaEstado(activada);

        if (!saved) return;

        if (activada && disponible) {
          setHaySesionGuardada(true); // requiere confirmación biométrica desde el login
        } else {
          await hidratarUsuario(saved);
        }
      } finally {
        setCargando(false);
      }
    })();
  }, [hidratarUsuario]);

  const iniciarSesion = useCallback(async (creds: LoginRequest) => {
    const res = await apiLogin(creds);
    await saveToken(res.accessToken);
    setToken(res.accessToken);
    setUsuario(res.usuario);
    setHaySesionGuardada(true);
  }, []);

  const cerrarSesion = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUsuario(null);
    setHaySesionGuardada(false);
  }, []);

  const iniciarSesionConBiometria = useCallback(async (): Promise<boolean> => {
    const ok = await autenticarConBiometria('Inicia sesión en WheelTrees');
    if (!ok) return false;

    const saved = await getToken();
    if (!saved) {
      setHaySesionGuardada(false);
      return false;
    }

    return hidratarUsuario(saved);
  }, [hidratarUsuario]);

  const habilitarBiometria = useCallback(async (): Promise<boolean> => {
    if (!biometricDisponible) return false;

    const ok = await autenticarConBiometria(
      'Confirma tu identidad para activar el inicio de sesión biométrico',
    );
    if (!ok) return false;

    await setBiometriaActivada(true);
    setBiometricActivadaEstado(true);
    return true;
  }, [biometricDisponible]);

  const deshabilitarBiometria = useCallback(async () => {
    await setBiometriaActivada(false);
    setBiometricActivadaEstado(false);
  }, []);

  const actualizarUsuarioLocal = useCallback((cambios: Partial<UsuarioResponse>) => {
    setUsuario(prev => (prev ? { ...prev, ...cambios } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        cargando,
        haySesionGuardada,
        biometricDisponible,
        biometricActivada,
        iniciarSesion,
        cerrarSesion,
        iniciarSesionConBiometria,
        habilitarBiometria,
        deshabilitarBiometria,
        actualizarUsuarioLocal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook de consumo ───────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
