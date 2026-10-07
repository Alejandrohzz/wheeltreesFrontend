import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import * as api from '@/services/api';
import * as auth from '@/services/auth';
import * as usuarios from '@/services/usuarios';
import * as notifications from '@/services/notifications';
import * as bio from '@/services/biometrics';

jest.mock('@/services/api', () => ({ getToken: jest.fn(), saveToken: jest.fn(), clearToken: jest.fn(), apiFetch: jest.fn() }));
jest.mock('@/services/auth', () => ({ login: jest.fn() }));
jest.mock('@/services/usuarios', () => ({ obtenerMiPerfil: jest.fn() }));
jest.mock('@/services/notifications', () => ({ registrarNotificacionesPush: jest.fn() }));
jest.mock('@/services/biometrics', () => ({
  autenticarConBiometria: jest.fn(), biometriaActivada: jest.fn(),
  biometriaDisponible: jest.fn(), setBiometriaActivada: jest.fn(),
}));

const m = (f: unknown) => f as jest.Mock;
const usuarioDemo = {
  id: 'u1', nombre: 'Ana', apellido: 'Gil', email: 'ana@unbosque.edu.co',
  rol: 'PASAJERO', fotoPerfil: null,
};
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

async function montar() {
  const r = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(r.result.current.cargando).toBe(false));
  return r;
}

beforeEach(() => {
  jest.clearAllMocks();
  m(api.getToken).mockResolvedValue(null);
  m(api.saveToken).mockResolvedValue(undefined);
  m(api.clearToken).mockResolvedValue(undefined);
  m(usuarios.obtenerMiPerfil).mockResolvedValue(usuarioDemo);
  m(notifications.registrarNotificacionesPush).mockResolvedValue(undefined);
  m(bio.biometriaDisponible).mockResolvedValue(false);
  m(bio.biometriaActivada).mockResolvedValue(false);
  m(bio.setBiometriaActivada).mockResolvedValue(undefined);
  m(bio.autenticarConBiometria).mockResolvedValue(true);
});

describe('[CTX] arranque de la app', () => {
  it('CTX-01 sin token guardado queda sin sesion', async () => {
    const { result } = await montar();
    expect(result.current.usuario).toBeNull();
    expect(result.current.haySesionGuardada).toBe(false);
  });
  it('CTX-02 con token y biometria desactivada abre la sesion', async () => {
    m(api.getToken).mockResolvedValue('tok-guardado');
    const { result } = await montar();
    expect(result.current.usuario).toEqual(usuarioDemo);
    expect(result.current.token).toBe('tok-guardado');
  });
  it('CTX-03 [UR-002] con biometria activa NO abre sesion hasta confirmar huella/rostro', async () => {
    m(api.getToken).mockResolvedValue('tok-guardado');
    m(bio.biometriaDisponible).mockResolvedValue(true);
    m(bio.biometriaActivada).mockResolvedValue(true);
    const { result } = await montar();
    expect(result.current.haySesionGuardada).toBe(true);
    expect(result.current.usuario).toBeNull();
    expect(usuarios.obtenerMiPerfil).not.toHaveBeenCalled();
  });
  it('CTX-04 token vencido: limpia el token y exige nuevo login', async () => {
    m(api.getToken).mockResolvedValue('tok-vencido');
    m(usuarios.obtenerMiPerfil).mockRejectedValue(new Error('401'));
    const { result } = await montar();
    expect(api.clearToken).toHaveBeenCalled();
    expect(result.current.usuario).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.haySesionGuardada).toBe(false);
  });
});

describe('[CTX] iniciar y cerrar sesion', () => {
  it('CTX-05 login correcto guarda el token y el usuario', async () => {
    m(auth.login).mockResolvedValue({ accessToken: 'tok123', tipo: 'Bearer', usuario: usuarioDemo });
    const { result } = await montar();
    await act(async () => { await result.current.iniciarSesion({ email: 'ana@unbosque.edu.co', password: 'Secreta123' }); });
    expect(api.saveToken).toHaveBeenCalledWith('tok123');
    expect(result.current.token).toBe('tok123');
    expect(result.current.usuario).toEqual(usuarioDemo);
    expect(notifications.registrarNotificacionesPush).toHaveBeenCalled();
  });
  it('CTX-06 login con credenciales invalidas propaga el error y no guarda nada', async () => {
    m(auth.login).mockRejectedValue(new Error('Credenciales invalidas'));
    const { result } = await montar();
    await expect(
      act(async () => { await result.current.iniciarSesion({ email: 'x@unbosque.edu.co', password: 'mal' }); }),
    ).rejects.toThrow('Credenciales invalidas');
    expect(api.saveToken).not.toHaveBeenCalled();
    expect(result.current.usuario).toBeNull();
  });
  it('CTX-07 respuesta 200 sin accessToken valido se rechaza (no llega a SecureStore)', async () => {
    m(auth.login).mockResolvedValue({ tipo: 'Bearer', usuario: usuarioDemo });
    const { result } = await montar();
    await expect(
      act(async () => { await result.current.iniciarSesion({ email: 'a@unbosque.edu.co', password: 'x' }); }),
    ).rejects.toThrow(/servidor no devolvi/);
    expect(api.saveToken).not.toHaveBeenCalled();
  });
  it('CTX-08 cerrarSesion limpia token y usuario', async () => {
    m(auth.login).mockResolvedValue({ accessToken: 'tok123', tipo: 'Bearer', usuario: usuarioDemo });
    const { result } = await montar();
    await act(async () => { await result.current.iniciarSesion({ email: 'a@unbosque.edu.co', password: 'x' }); });
    await act(async () => { await result.current.cerrarSesion(); });
    expect(api.clearToken).toHaveBeenCalled();
    expect(result.current.usuario).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.haySesionGuardada).toBe(false);
  });
});

describe('[CTX] [UR-002] biometria', () => {
  it('CTX-09 biometria rechazada: no retoma la sesion', async () => {
    m(bio.autenticarConBiometria).mockResolvedValue(false);
    const { result } = await montar();
    let ok = true;
    await act(async () => { ok = await result.current.iniciarSesionConBiometria(); });
    expect(ok).toBe(false);
    expect(api.getToken).toHaveBeenCalledTimes(1); // solo la del arranque
  });
  it('CTX-10 biometria correcta con token guardado: retoma la sesion', async () => {
    m(api.getToken).mockResolvedValue('tok-guardado');
    m(bio.biometriaDisponible).mockResolvedValue(true);
    m(bio.biometriaActivada).mockResolvedValue(true);
    const { result } = await montar();
    let ok = false;
    await act(async () => { ok = await result.current.iniciarSesionConBiometria(); });
    expect(ok).toBe(true);
    expect(result.current.usuario).toEqual(usuarioDemo);
  });
  it('CTX-11 biometria correcta pero sin token guardado: falla', async () => {
    const { result } = await montar();
    let ok = true;
    await act(async () => { ok = await result.current.iniciarSesionConBiometria(); });
    expect(ok).toBe(false);
    expect(result.current.haySesionGuardada).toBe(false);
  });
  it('CTX-12 habilitarBiometria sin sensor devuelve false', async () => {
    const { result } = await montar();
    let ok = true;
    await act(async () => { ok = await result.current.habilitarBiometria(); });
    expect(ok).toBe(false);
    expect(bio.setBiometriaActivada).not.toHaveBeenCalled();
  });
  it('CTX-13 habilitarBiometria con sensor y confirmacion activa la preferencia', async () => {
    m(bio.biometriaDisponible).mockResolvedValue(true);
    const { result } = await montar();
    let ok = false;
    await act(async () => { ok = await result.current.habilitarBiometria(); });
    expect(ok).toBe(true);
    expect(bio.setBiometriaActivada).toHaveBeenCalledWith(true);
    expect(result.current.biometricActivada).toBe(true);
  });
  it('CTX-14 deshabilitarBiometria apaga la preferencia', async () => {
    m(bio.biometriaDisponible).mockResolvedValue(true);
    const { result } = await montar();
    await act(async () => { await result.current.habilitarBiometria(); });
    await act(async () => { await result.current.deshabilitarBiometria(); });
    expect(bio.setBiometriaActivada).toHaveBeenLastCalledWith(false);
    expect(result.current.biometricActivada).toBe(false);
  });
});

describe('[CTX] utilidades', () => {
  it('CTX-15 actualizarUsuarioLocal mezcla cambios (ej. cambio de rol)', async () => {
    m(api.getToken).mockResolvedValue('tok');
    const { result } = await montar();
    await act(async () => { result.current.actualizarUsuarioLocal({ rol: 'CONDUCTOR' }); });
    expect(result.current.usuario?.rol).toBe('CONDUCTOR');
    expect(result.current.usuario?.nombre).toBe('Ana');
  });
  it('CTX-16 useAuth fuera de AuthProvider lanza error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useAuth())).rejects.toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});