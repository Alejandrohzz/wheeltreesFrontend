import * as viajes from '@/services/viajes';
import { apiFetch } from '@/services/api';

jest.mock('@/services/api', () => ({ apiFetch: jest.fn() }));
const api = apiFetch as unknown as jest.Mock;

beforeEach(() => {
  api.mockReset();
  api.mockResolvedValue([]);
});

describe('[VIAJES] publicar y consultar', () => {
  it('VIA-01 crearViaje hace POST /api/viajes con el cuerpo', async () => {
    const body = {
      vehiculoId: 'veh-1', origenDescripcion: 'Usaquen', destinoDescripcion: 'Universidad El Bosque',
      fechaHoraSalida: '2026-10-07T06:30:00', cuposTotales: 3, aportePorPasajero: 4000,
    };
    await viajes.crearViaje(body);
    expect(api).toHaveBeenCalledWith('/api/viajes', { method: 'POST', body: JSON.stringify(body) });
  });
  it('VIA-02 detalleViaje consulta por id', async () => {
    await viajes.detalleViaje('abc');
    expect(api).toHaveBeenCalledWith('/api/viajes/abc');
  });
  it('VIA-03 listarMisViajes usa /mis-viajes', async () => {
    await viajes.listarMisViajes();
    expect(api).toHaveBeenCalledWith('/api/viajes/mis-viajes');
  });
});

describe('[VIAJES] [UR-006] filtros de busqueda', () => {
  it('VIA-04 sin filtros no agrega query string', async () => {
    await viajes.listarViajes();
    expect(api).toHaveBeenCalledWith('/api/viajes');
  });
  it('VIA-05 aplica trim y omite filtros vacios', async () => {
    await viajes.listarViajes({ origen: '  Usaquen ', destino: '', fecha: '2026-10-07' });
    expect(api).toHaveBeenCalledWith('/api/viajes?origen=Usaquen&fecha=2026-10-07');
  });
  it('VIA-06 omite filtros con solo espacios', async () => {
    await viajes.listarViajes({ origen: '   ' });
    expect(api).toHaveBeenCalledWith('/api/viajes');
  });
  it('VIA-07 combina origen, destino, fecha y rango horario', async () => {
    await viajes.listarViajes({ origen: 'Usaquen', destino: 'Bosque', fecha: '2026-10-07', horaDesde: '06:00', horaHasta: '09:00' });
    const url = api.mock.calls[0][0] as string;
    const qs = new URLSearchParams(url.split('?')[1]);
    expect(Object.fromEntries(qs)).toEqual({
      origen: 'Usaquen', destino: 'Bosque', fecha: '2026-10-07', horaDesde: '06:00', horaHasta: '09:00',
    });
  });
  it('VIA-08 codifica caracteres especiales en los filtros', async () => {
    await viajes.listarViajes({ destino: 'Cafam & Cia' });
    expect(api).toHaveBeenCalledWith('/api/viajes?destino=Cafam+%26+Cia');
  });
});

describe('[VIAJES] ciclo de vida del viaje', () => {
  it('VIA-09 cancelarViaje usa DELETE', async () => {
    await viajes.cancelarViaje('v1');
    expect(api).toHaveBeenCalledWith('/api/viajes/v1', { method: 'DELETE' });
  });
  it('VIA-10 iniciarViaje usa PATCH /iniciar', async () => {
    await viajes.iniciarViaje('v1');
    expect(api).toHaveBeenCalledWith('/api/viajes/v1/iniciar', { method: 'PATCH' });
  });
  it('VIA-11 completarViaje usa PATCH /completar', async () => {
    await viajes.completarViaje('v1');
    expect(api).toHaveBeenCalledWith('/api/viajes/v1/completar', { method: 'PATCH' });
  });
  it('VIA-12 propaga errores del backend', async () => {
    api.mockRejectedValue(new Error('403 Forbidden'));
    await expect(viajes.iniciarViaje('v1')).rejects.toThrow('403 Forbidden');
  });
});