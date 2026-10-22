import { apiFetch, BASE_URL, clearToken, getToken, saveToken } from '@/services/api';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => (mockStore.has(k) ? (mockStore.get(k) as string) : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
  deleteItemAsync: jest.fn(async (k: string) => { mockStore.delete(k); }),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: '192.168.1.5:8081' } },
}));

const fetchMock = jest.fn();
const ok = (data: any) => ({ ok: true, status: 200, json: async () => data });
const fail = (status: number, data: any) => ({ ok: false, status, json: async () => data });
let logSpy: jest.SpyInstance;

beforeAll(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { logSpy.mockRestore(); });
beforeEach(() => {
  mockStore.clear();
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
});

describe('[API] peticiones', () => {
  it('API-01 sin token: llama a BASE_URL+path y no envia Authorization', async () => {
    fetchMock.mockResolvedValue(ok({ a: 1 }));
    await apiFetch('/api/x');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/x`);
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });
  it('API-02 con token guardado agrega Authorization: Bearer', async () => {
    mockStore.set('wt_access_token', 'abc123');
    fetchMock.mockResolvedValue(ok({}));
    await apiFetch('/api/x');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc123');
  });
  it('API-03 conserva headers personalizados', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await apiFetch('/api/x', { headers: { 'X-Test': '1' } });
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ 'X-Test': '1', 'Content-Type': 'application/json' });
  });
  it('API-04 reenvia metodo y cuerpo', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await apiFetch('/api/x', { method: 'POST', body: '{"a":1}' });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
  });
  it('API-05 devuelve el JSON de la respuesta', async () => {
    fetchMock.mockResolvedValue(ok({ id: 7, nombre: 'Ana' }));
    await expect(apiFetch('/api/x')).resolves.toEqual({ id: 7, nombre: 'Ana' });
  });
  it('API-06 respuesta exitosa sin JSON valido devuelve {}', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: () => Promise.reject(new Error('sin cuerpo')) });
    await expect(apiFetch('/api/x')).resolves.toEqual({});
  });
  it('API-07 BASE_URL esta definida y es http(s)', () => {
    expect(BASE_URL).toMatch(/^https?:\/\//);
  });
});

describe('[API] errores del backend', () => {
  it('API-08 usa data.message cuando existe (tiene prioridad)', async () => {
    fetchMock.mockResolvedValue(fail(400, { message: 'Mensaje claro', error: 'otro' }));
    await expect(apiFetch('/x')).rejects.toThrow('Mensaje claro');
  });
  it('API-09 une los mensajes de data.errors (Bean Validation)', async () => {
    fetchMock.mockResolvedValue(fail(400, { errors: [{ defaultMessage: 'Email invalido' }, { field: 'password' }] }));
    const err = await apiFetch('/x').catch((e) => e);
    expect(err.message).toContain('Email invalido');
    expect(err.message).toContain('password');
  });
  it('API-10 une los valores de data.errores (formato WheelTrees)', async () => {
    fetchMock.mockResolvedValue(fail(422, { errores: { email: 'Correo duplicado', placa: 'Placa invalida' } }));
    await expect(apiFetch('/x')).rejects.toThrow('Correo duplicado, Placa invalida');
  });
  it('API-11 combina error y detalle', async () => {
    fetchMock.mockResolvedValue(fail(409, { error: 'Conflicto', detalle: 'Cupo agotado' }));
    await expect(apiFetch('/x')).rejects.toThrow('Conflicto: Cupo agotado');
  });
  it('API-12 usa solo error cuando no hay detalle', async () => {
    fetchMock.mockResolvedValue(fail(404, { error: 'No encontrado' }));
    await expect(apiFetch('/x')).rejects.toThrow('No encontrado');
  });
  it('API-13 sin cuerpo util cae a "Error <status>"', async () => {
    fetchMock.mockResolvedValue(fail(500, {}));
    await expect(apiFetch('/x')).rejects.toThrow('Error 500');
  });
  it('API-14 [hallazgo] un 401 no limpia el token (no hay cierre de sesion automatico)', async () => {
    mockStore.set('wt_access_token', 'vencido');
    fetchMock.mockResolvedValue(fail(401, {}));
    await expect(apiFetch('/x')).rejects.toThrow('Error 401');
    expect(mockStore.get('wt_access_token')).toBe('vencido');
  });
  it('API-15 fallo de red se propaga', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiFetch('/x')).rejects.toThrow('Network request failed');
  });
});

describe('[API] token en SecureStore', () => {
  it('API-16 guardar, leer y borrar el token', async () => {
    await saveToken('tok');
    expect(mockStore.get('wt_access_token')).toBe('tok');
    await expect(getToken()).resolves.toBe('tok');
    await clearToken();
    await expect(getToken()).resolves.toBeNull();
  });
});