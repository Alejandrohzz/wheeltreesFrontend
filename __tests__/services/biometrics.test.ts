import * as LA from 'expo-local-authentication';
import * as bio from '@/services/biometrics';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => (mockStore.has(k) ? (mockStore.get(k) as string) : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
  deleteItemAsync: jest.fn(async (k: string) => { mockStore.delete(k); }),
}));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
}));

const m = (f: unknown) => f as jest.Mock;
const FALLA = { success: false, error: 'authentication_failed' };
const OK = { success: true };

beforeEach(() => {
  mockStore.clear();
  m(LA.hasHardwareAsync).mockReset().mockResolvedValue(true);
  m(LA.isEnrolledAsync).mockReset().mockResolvedValue(true);
  m(LA.authenticateAsync).mockReset().mockResolvedValue(FALLA);
});

describe('[BIO] disponibilidad del sensor', () => {
  it('BIO-01 sin hardware: no disponible', async () => {
    m(LA.hasHardwareAsync).mockResolvedValue(false);
    await expect(bio.biometriaDisponible()).resolves.toBe(false);
  });
  it('BIO-02 con hardware pero sin huella/rostro registrado: no disponible', async () => {
    m(LA.isEnrolledAsync).mockResolvedValue(false);
    await expect(bio.biometriaDisponible()).resolves.toBe(false);
  });
  it('BIO-03 con hardware y biometria registrada: disponible', async () => {
    await expect(bio.biometriaDisponible()).resolves.toBe(true);
  });
});

describe('[BIO] [UR-002] autenticacion', () => {
  it('BIO-04 si no esta disponible devuelve false sin abrir el prompt', async () => {
    m(LA.hasHardwareAsync).mockResolvedValue(false);
    await expect(bio.autenticarConBiometria()).resolves.toBe(false);
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });
  it('BIO-05 exito en el primer intento (biometria pura, sin respaldo)', async () => {
    m(LA.authenticateAsync).mockResolvedValue(OK);
    await expect(bio.autenticarConBiometria()).resolves.toBe(true);
    expect(LA.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(m(LA.authenticateAsync).mock.calls[0][0]).toMatchObject({ disableDeviceFallback: true });
  });
  it('BIO-06 si la biometria falla, ofrece el respaldo del dispositivo', async () => {
    m(LA.authenticateAsync).mockResolvedValueOnce(FALLA).mockResolvedValueOnce(OK);
    await expect(bio.autenticarConBiometria()).resolves.toBe(true);
    expect(LA.authenticateAsync).toHaveBeenCalledTimes(2);
    expect(m(LA.authenticateAsync).mock.calls[1][0]).toMatchObject({ disableDeviceFallback: false });
  });
  it('BIO-07 fallo real en ambos intentos: false y suma 1 intento fallido', async () => {
    await expect(bio.autenticarConBiometria()).resolves.toBe(false);
    const e = await bio.obtenerEstadoBloqueoBiometrico();
    expect(e.intentosFallidos).toBe(1);
    expect(e.intentosRestantes).toBe(2);
    expect(e.bloqueada).toBe(false);
  });
  it('BIO-08 cancelar el prompt NO cuenta como intento fallido', async () => {
    m(LA.authenticateAsync).mockResolvedValue({ success: false, error: 'user_cancel' });
    await expect(bio.autenticarConBiometria()).resolves.toBe(false);
    expect((await bio.obtenerEstadoBloqueoBiometrico()).intentosFallidos).toBe(0);
  });
  it('BIO-09 3 fallos seguidos bloquean la biometria', async () => {
    for (let i = 0; i < 3; i++) await bio.autenticarConBiometria();
    const e = await bio.obtenerEstadoBloqueoBiometrico();
    expect(e.bloqueada).toBe(true);
    expect(e.intentosRestantes).toBe(0);
  });
  it('BIO-10 bloqueada: rechaza sin abrir el prompt del sistema', async () => {
    for (let i = 0; i < 3; i++) await bio.autenticarConBiometria();
    m(LA.authenticateAsync).mockClear();
    await expect(bio.autenticarConBiometria()).resolves.toBe(false);
    expect(LA.authenticateAsync).not.toHaveBeenCalled();
  });
  it('BIO-11 reiniciarIntentosBiometricos (desbloqueo con codigo) vuelve a permitir', async () => {
    for (let i = 0; i < 3; i++) await bio.autenticarConBiometria();
    await bio.reiniciarIntentosBiometricos();
    expect((await bio.obtenerEstadoBloqueoBiometrico()).bloqueada).toBe(false);
    m(LA.authenticateAsync).mockResolvedValue(OK);
    await expect(bio.autenticarConBiometria()).resolves.toBe(true);
  });
  it('BIO-12 un acierto reinicia el contador de fallos', async () => {
    await bio.autenticarConBiometria();
    await bio.autenticarConBiometria();
    m(LA.authenticateAsync).mockResolvedValue(OK);
    await bio.autenticarConBiometria();
    expect((await bio.obtenerEstadoBloqueoBiometrico()).intentosFallidos).toBe(0);
  });
});

describe('[BIO] estado del contador', () => {
  it('BIO-13 estado inicial: 0 fallos, 3 restantes, sin bloqueo', async () => {
    await expect(bio.obtenerEstadoBloqueoBiometrico()).resolves.toEqual({
      bloqueada: false, intentosFallidos: 0, intentosRestantes: 3,
    });
  });
  it('BIO-14 valores corruptos o negativos en el almacen se tratan como 0', async () => {
    mockStore.set('wt_biometric_fallos', 'abc');
    expect((await bio.obtenerEstadoBloqueoBiometrico()).intentosFallidos).toBe(0);
    mockStore.set('wt_biometric_fallos', '-2');
    expect((await bio.obtenerEstadoBloqueoBiometrico()).intentosFallidos).toBe(0);
  });
  it('BIO-15 el limite configurado es 3 intentos', () => {
    expect(bio.MAX_INTENTOS_BIOMETRICOS).toBe(3);
  });
});

describe('[BIO] preferencias guardadas', () => {
  it('BIO-16 activar y desactivar el login biometrico', async () => {
    await expect(bio.biometriaActivada()).resolves.toBe(false);
    await bio.setBiometriaActivada(true);
    await expect(bio.biometriaActivada()).resolves.toBe(true);
    await bio.setBiometriaActivada(false);
    await expect(bio.biometriaActivada()).resolves.toBe(false);
  });
  it('BIO-17 recuerda el ultimo usuario (solo el nombre, sin contrasena)', async () => {
    await expect(bio.obtenerUltimoUsuario()).resolves.toBeNull();
    await bio.guardarUltimoUsuario('ana');
    await expect(bio.obtenerUltimoUsuario()).resolves.toBe('ana');
  });
});