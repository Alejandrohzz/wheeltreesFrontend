import { apiFetch } from './api';
import { Viaje } from './types';

export interface ViajeRequest {
  // El backend (PublicarViajeRequest) exige el UUID del vehículo, no la placa.
  vehiculoId:         string;
  origenDescripcion:  string;
  destinoDescripcion: string;
  // Coordenadas opcionales del origen/destino (si el backend las soporta,
  // permiten mostrar el viaje publicado en el mapa de home).
  origenLat?:         number;
  origenLng?:         number;
  destinoLat?:        number;
  destinoLng?:        number;
  fechaHoraSalida:    string; // ISO 8601
  cuposTotales:       number;
  aportePorPasajero:  number;
  notas?:             string;
}

/** POST /api/viajes — publica un nuevo viaje (el usuario autenticado queda como conductor) */
export const crearViaje = (body: ViajeRequest) =>
  apiFetch<Viaje>('/api/viajes', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** GET /api/viajes — lista los viajes disponibles */
export const listarViajes = () =>
  apiFetch<Viaje[]>('/api/viajes');

/** GET /api/viajes/{id} — detalle de un viaje puntual */
export const detalleViaje = (id: string) =>
  apiFetch<Viaje>(`/api/viajes/${id}`);

/** GET /api/viajes/mis-viajes — viajes publicados por el conductor autenticado */
export const listarMisViajes = () =>
  apiFetch<Viaje[]>('/api/viajes/mis-viajes');

/**
 * DELETE /api/viajes/{id} — cancela el viaje (el backend expone esto como
 * DELETE, no como PATCH /cancelar; devuelve 204 sin cuerpo).
 */
export const cancelarViaje = (id: string) =>
  apiFetch<void>(`/api/viajes/${id}`, { method: 'DELETE' });

/** PATCH /api/viajes/{id}/iniciar — el conductor arranca el viaje (PROGRAMADO → EN_CURSO) */
export const iniciarViaje = (id: string) =>
  apiFetch<Viaje>(`/api/viajes/${id}/iniciar`, { method: 'PATCH' });

/** PATCH /api/viajes/{id}/completar — el conductor termina el viaje (EN_CURSO → COMPLETADO) */
export const completarViaje = (id: string) =>
  apiFetch<Viaje>(`/api/viajes/${id}/completar`, { method: 'PATCH' });
