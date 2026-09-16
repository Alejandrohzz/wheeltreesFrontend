import { apiFetch } from './api';
import { TipoVehiculo, Vehiculo } from './types';

export interface VehiculoRequest {
  tipo:               TipoVehiculo;
  placa:              string;
  marca:              string;
  modelo:             string;
  anio:               number;
  color:              string;
  capacidadPasajeros: number;
  cedulaPropietario:  string;
  fotoVehiculo?:      string;
  /** El conductor declara que el vehículo tiene todos los papeles al día (SOAT, tecnomecánica, licencia, etc.) */
  terminosAceptados:  boolean;
}

/** GET /api/vehiculos/mis-vehiculos — lista los vehículos del conductor autenticado */
export const listarVehiculos = () =>
  apiFetch<Vehiculo[]>('/api/vehiculos/mis-vehiculos');

/** POST /api/vehiculos */
export const crearVehiculo = (body: VehiculoRequest) =>
  apiFetch<Vehiculo>('/api/vehiculos', {
    method: 'POST',
    body:   JSON.stringify(body),
  });

/** PUT /api/vehiculos/{id} */
export const actualizarVehiculo = (id: string, body: VehiculoRequest) =>
  apiFetch<Vehiculo>(`/api/vehiculos/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(body),
  });

/** PATCH /api/vehiculos/{id}/desactivar */
export const desactivarVehiculo = (id: string) =>
  apiFetch<Vehiculo>(`/api/vehiculos/${id}/desactivar`, {
    method: 'PATCH',
  });

/** PATCH /api/vehiculos/{id}/activar */
export const activarVehiculo = (id: string) =>
  apiFetch<Vehiculo>(`/api/vehiculos/${id}/activar`, {
    method: 'PATCH',
  });
