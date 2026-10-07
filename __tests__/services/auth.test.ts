import * as auth from '@/services/auth';
import { apiFetch } from '@/services/api';

jest.mock('@/services/api', () => ({ apiFetch: jest.fn() }));
const api = apiFetch as unknown as jest.Mock;

beforeEach(() => {
  api.mockReset();
  api.mockResolvedValue({ exito: true, mensaje: 'ok' });
});

describe('[AUTH] helpers de correo institucional', () => {
  it('AUTH-01 agrega el dominio institucional al usuario', () => {
    expect(auth.construirEmailDesdeUsuario('juan.perez')).toBe('juan.perez@unbosque.edu.co');
  });
  it('AUTH-02 normaliza mayusculas y espacios', () => {
    expect(auth.construirEmailDesdeUsuario('  Juan.Perez  ')).toBe('juan.perez@unbosque.edu.co');
  });
  it('AUTH-03 ignora un dominio ajeno y fuerza el institucional', () => {
    expect(auth.construirEmailDesdeUsuario('juan@gmail.com')).toBe('juan@unbosque.edu.co');
  });
  it('AUTH-04 no duplica el dominio si ya viene completo', () => {
    expect(auth.construirEmailDesdeUsuario('juan@unbosque.edu.co')).toBe('juan@unbosque.edu.co');
  });
  it('AUTH-05 extrae la parte de usuario del email', () => {
    expect(auth.extraerUsuarioDeEmail('juan@unbosque.edu.co')).toBe('juan');
  });
});

describe('[AUTH] llamadas al backend', () => {
  it('AUTH-06 login hace POST /api/auth/login con credenciales', async () => {
    const creds = { email: 'a@unbosque.edu.co', password: 'Secreta123' };
    await auth.login(creds);
    expect(api).toHaveBeenCalledWith('/api/auth/login', { method: 'POST', body: JSON.stringify(creds) });
  });
  it('AUTH-07 login propaga el error del backend (credenciales invalidas)', async () => {
    api.mockRejectedValue(new Error('Credenciales invalidas'));
    await expect(auth.login({ email: 'a@unbosque.edu.co', password: 'x' })).rejects.toThrow('Credenciales invalidas');
  });
  it('AUTH-08 registro hace POST /api/auth/registrar', async () => {
    const body = { nombre: 'Ana', apellido: 'Gil', email: 'ana@unbosque.edu.co', password: 'Secreta123', rol: 'PASAJERO' as any };
    await auth.registro(body);
    expect(api).toHaveBeenCalledWith('/api/auth/registrar', { method: 'POST', body: JSON.stringify(body) });
  });
  it('AUTH-09 verificarEmail envia email y codigo OTP', async () => {
    const body = { email: 'ana@unbosque.edu.co', codigoOtp: '123456' };
    await auth.verificarEmail(body);
    expect(api).toHaveBeenCalledWith('/api/auth/verificar-email', { method: 'POST', body: JSON.stringify(body) });
  });
  it('AUTH-10 reenviarOtp codifica el email en la URL', async () => {
    await auth.reenviarOtp('a+b@unbosque.edu.co');
    expect(api).toHaveBeenCalledWith('/api/auth/reenviar-otp?email=a%2Bb%40unbosque.edu.co', { method: 'POST' });
  });
  it('AUTH-11 flujo de recuperacion de contrasena usa los 3 endpoints', async () => {
    await auth.solicitarRecuperacion('a@unbosque.edu.co');
    await auth.verificarCodigoRecuperacion('a@unbosque.edu.co', '111111');
    await auth.restablecerPassword('a@unbosque.edu.co', '111111', 'Nueva1234');
    expect(api.mock.calls.map((c) => c[0])).toEqual([
      '/api/auth/recuperar-password/solicitar',
      '/api/auth/recuperar-password/verificar',
      '/api/auth/recuperar-password/restablecer',
    ]);
    expect(JSON.parse(api.mock.calls[2][1].body)).toEqual({
      email: 'a@unbosque.edu.co', codigoOtp: '111111', nuevaPassword: 'Nueva1234',
    });
  });
  it('AUTH-12 [UR-002] desbloqueo biometrico solicita y verifica codigo', async () => {
    await auth.solicitarDesbloqueoBiometrico('a@unbosque.edu.co');
    await auth.verificarDesbloqueoBiometrico('a@unbosque.edu.co', '222222');
    expect(api.mock.calls.map((c) => c[0])).toEqual([
      '/api/auth/desbloqueo-biometrico/solicitar',
      '/api/auth/desbloqueo-biometrico/verificar',
    ]);
  });
});