import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from '@/app/login';
import * as admin from '@/services/admin';
import * as bio from '@/services/biometrics';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRouter = { replace: mockReplace, push: mockPush };
let mockAuth: any;

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/contexts/ThemeContext', () => ({ useAppTheme: () => ({ isDark: false }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o && o.n !== undefined ? `${k}:${o.n}` : k) }),
}));
jest.mock('@/services/api', () => ({ apiFetch: jest.fn() }));
jest.mock('@/services/admin', () => ({ esUsuarioAdmin: jest.fn(), loginAdmin: jest.fn() }));
jest.mock('@/services/biometrics', () => ({
  guardarUltimoUsuario: jest.fn(),
  obtenerEstadoBloqueoBiometrico: jest.fn(),
  obtenerUltimoUsuario: jest.fn(),
}));
jest.mock('@/components/BiometricUnlockModal', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: (p: any) => (p.visible ? R.createElement(Text, null, 'MODAL_ABIERTO') : null) };
});

const m = (f: unknown) => f as jest.Mock;
const estado = (f = 0) => ({ bloqueada: f >= 3, intentosFallidos: f, intentosRestantes: Math.max(0, 3 - f) });
const setAuth = (over: any = {}) => {
  mockAuth = {
    usuario: null, cargando: false,
    iniciarSesion: jest.fn().mockResolvedValue(undefined),
    iniciarSesionConBiometria: jest.fn().mockResolvedValue(false),
    biometricDisponible: false, biometricActivada: false, haySesionGuardada: false,
    habilitarBiometria: jest.fn().mockResolvedValue(true),
    ...over,
  };
};
const BIO_ON = { biometricDisponible: true, biometricActivada: true, haySesionGuardada: true };
let alertSpy: jest.SpyInstance;

beforeAll(() => { alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterAll(() => { alertSpy.mockRestore(); });
beforeEach(() => {
  jest.clearAllMocks();
  setAuth();
  m(bio.obtenerUltimoUsuario).mockReset().mockResolvedValue(null);
  m(bio.obtenerEstadoBloqueoBiometrico).mockReset().mockResolvedValue(estado(0));
  m(bio.guardarUltimoUsuario).mockReset().mockResolvedValue(undefined);
  m(admin.esUsuarioAdmin).mockReset().mockReturnValue(false);
  m(admin.loginAdmin).mockReset().mockResolvedValue(undefined);
});

async function pantalla() {
  return render(<LoginScreen />);
}
async function llenar(u: any, usuario: string, password: string) {
  await fireEvent.changeText(u.getByPlaceholderText('login.usernamePlaceholder'), usuario);
  await fireEvent.changeText(u.getByPlaceholderText('login.passwordPlaceholder'), password);
}

describe('[LOGIN] formulario y validaciones', () => {
  it('LOG-01 muestra titulo, campos y boton de ingreso', async () => {
    const u = await pantalla();
    expect(u.getByText('login.title')).toBeTruthy();
    expect(u.getByPlaceholderText('login.usernamePlaceholder')).toBeTruthy();
    expect(u.getByPlaceholderText('login.passwordPlaceholder')).toBeTruthy();
    expect(u.getByText('login.signInButton')).toBeTruthy();
  });
  it('LOG-02 usuario vacio: muestra error y no llama al backend', async () => {
    const u = await pantalla();
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(u.getByText('login.errorUsernameRequired')).toBeTruthy());
    expect(mockAuth.iniciarSesion).not.toHaveBeenCalled();
  });
  it('LOG-03 contrasena vacia: muestra error y no llama al backend', async () => {
    const u = await pantalla();
    await fireEvent.changeText(u.getByPlaceholderText('login.usernamePlaceholder'), 'ana');
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(u.getByText('login.errorPasswordRequired')).toBeTruthy());
    expect(mockAuth.iniciarSesion).not.toHaveBeenCalled();
  });
  it('LOG-04 prellena el ultimo usuario que inicio sesion en el equipo', async () => {
    m(bio.obtenerUltimoUsuario).mockResolvedValue('maria');
    const u = await pantalla();
    await waitFor(() => expect(u.getByPlaceholderText('login.usernamePlaceholder').props.value).toBe('maria'));
  });
});

describe('[LOGIN] inicio de sesion', () => {
  it('LOG-05 login correcto: arma el correo institucional, guarda el usuario y entra a /home', async () => {
    const u = await pantalla();
    await llenar(u, 'Ana', 'Secreta123');
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
    expect(mockAuth.iniciarSesion).toHaveBeenCalledWith({ email: 'ana@unbosque.edu.co', password: 'Secreta123' });
    expect(bio.guardarUltimoUsuario).toHaveBeenCalledWith('ana');
  });
  it('LOG-06 si escribe un correo ajeno, fuerza el dominio institucional', async () => {
    const u = await pantalla();
    await llenar(u, 'ana@gmail.com', 'Secreta123');
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(mockAuth.iniciarSesion).toHaveBeenCalled());
    expect(mockAuth.iniciarSesion.mock.calls[0][0].email).toBe('ana@unbosque.edu.co');
  });
  it('LOG-07 credenciales invalidas: muestra el mensaje del backend y no navega', async () => {
    mockAuth.iniciarSesion.mockRejectedValue(new Error('Credenciales invalidas'));
    const u = await pantalla();
    await llenar(u, 'ana', 'mala');
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(u.getByText('Credenciales invalidas')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('LOG-08 error sin mensaje usa el texto generico', async () => {
    mockAuth.iniciarSesion.mockRejectedValue({});
    const u = await pantalla();
    await llenar(u, 'ana', 'x');
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(u.getByText('login.errorGeneric')).toBeTruthy());
  });
  it('LOG-09 acceso de administrador: usa loginAdmin y va a /admin', async () => {
    m(admin.esUsuarioAdmin).mockReturnValue(true);
    const u = await pantalla();
    await llenar(u, 'admin', 'ClaveAdmin1');
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin'));
    expect(admin.loginAdmin).toHaveBeenCalledWith('admin', 'ClaveAdmin1');
    expect(mockAuth.iniciarSesion).not.toHaveBeenCalled();
  });
  it('LOG-10 administrador con clave incorrecta: muestra error', async () => {
    m(admin.esUsuarioAdmin).mockReturnValue(true);
    m(admin.loginAdmin).mockRejectedValue(new Error('Clave de administrador incorrecta'));
    const u = await pantalla();
    await llenar(u, 'admin', 'mala');
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(u.getByText('Clave de administrador incorrecta')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('LOG-11 con sesion ya activa redirige directo a /home', async () => {
    setAuth({ usuario: { id: 'u1' } });
    await pantalla();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
  });
});

describe('[LOGIN] [UR-002] biometria', () => {
  it('LOG-12 sin biometria activada no muestra el boton biometrico', async () => {
    const u = await pantalla();
    expect(u.queryByText('login.biometricButton')).toBeNull();
    expect(mockAuth.iniciarSesionConBiometria).not.toHaveBeenCalled();
  });
  it('LOG-13 con biometria activa lanza el prompt automaticamente una sola vez y entra', async () => {
    setAuth({ ...BIO_ON, iniciarSesionConBiometria: jest.fn().mockResolvedValue(true) });
    const u = await pantalla();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
    expect(mockAuth.iniciarSesionConBiometria).toHaveBeenCalledTimes(1);
    expect(u.getByText('login.biometricButton')).toBeTruthy();
  });
  it('LOG-14 fallo biometrico: avisa cuantos intentos quedan', async () => {
    setAuth({ ...BIO_ON });
    m(bio.obtenerEstadoBloqueoBiometrico)
      .mockResolvedValueOnce(estado(0))
      .mockResolvedValueOnce(estado(0))
      .mockResolvedValue(estado(1));
    const u = await pantalla();
    await waitFor(() => expect(u.getByText('login.biometricAttemptsLeft:2')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('LOG-15 biometria bloqueada: oculta el boton, no abre el prompt y exige el codigo del correo', async () => {
    setAuth({ ...BIO_ON });
    m(bio.obtenerEstadoBloqueoBiometrico).mockResolvedValue(estado(3));
    const u = await pantalla();
    await waitFor(() => expect(u.getByText('login.biometricLockedTitle')).toBeTruthy());
    expect(u.queryByText('login.biometricButton')).toBeNull();
    expect(mockAuth.iniciarSesionConBiometria).not.toHaveBeenCalled();

    // sin usuario escrito no puede pedir el codigo
    await fireEvent.press(u.getByText('login.biometricUnlockButton'));
    await waitFor(() => expect(u.getByText('login.errorUsernameRequired')).toBeTruthy());
    expect(u.queryByText('MODAL_ABIERTO')).toBeNull();

    // con usuario escrito abre el modal de desbloqueo
    await fireEvent.changeText(u.getByPlaceholderText('login.usernamePlaceholder'), 'ana');
    await fireEvent.press(u.getByText('login.biometricUnlockButton'));
    await waitFor(() => expect(u.getByText('MODAL_ABIERTO')).toBeTruthy());
  });
  it('LOG-16 tras el login ofrece activar biometria y, si acepta, la habilita', async () => {
    setAuth({ biometricDisponible: true, biometricActivada: false });
    const u = await pantalla();
    await llenar(u, 'ana', 'Secreta123');
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    const botones = alertSpy.mock.calls[0][2] as any[];
    await act(async () => { await botones[1].onPress(); });
    expect(mockAuth.habilitarBiometria).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });
  it('LOG-17 si responde "ahora no", entra sin habilitar biometria', async () => {
    setAuth({ biometricDisponible: true, biometricActivada: false });
    const u = await pantalla();
    await llenar(u, 'ana', 'Secreta123');
    await fireEvent.press(u.getByText('login.signInButton'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const botones = alertSpy.mock.calls[0][2] as any[];
    await act(async () => { await botones[0].onPress(); });
    expect(mockAuth.habilitarBiometria).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });
});

describe('[LOGIN] navegacion', () => {
  it('LOG-18 enlaces a recuperar contrasena y a registro', async () => {
    const u = await pantalla();
    await fireEvent.press(u.getByText('login.forgotPassword'));
    expect(mockPush).toHaveBeenCalledWith('/forgot-password');
    await fireEvent.press(u.getByText('login.registerLink'));
    expect(mockPush).toHaveBeenCalledWith('/register');
  });
});