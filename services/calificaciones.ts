import { apiFetch } from './api';

export interface CrearCalificacionRequest {
  reservaId:   string;
  puntuacion:  number; // 1-5
  comentario?: string;
}

export interface Calificacion {
  id:               string;
  reservaId:        string;
  calificadorId:    string;
  calificadorNombre: string;
  calificadoId:     string;
  calificadoNombre: string;
  puntuacion:       number;
  comentario?:      string | null;
  creadoEn:         string;
}

export interface CalificacionPendiente {
  reservaId:        string;
  viajeId:          string;
  origenViaje:      string;
  fechaHoraSalida:  string;
  /** A quién le falta calificar al usuario autenticado. */
  aCalificarId:     string;
  aCalificarNombre: string;
  /** Rol de esa persona en el viaje (si el backend lo envía). */
  aCalificarRol?:   'CONDUCTOR' | 'PASAJERO';
}

export function calificar(data: CrearCalificacionRequest): Promise<Calificacion> {
  return apiFetch('/api/calificaciones', { method: 'POST', body: JSON.stringify(data) });
}

export function obtenerPendientes(): Promise<CalificacionPendiente[]> {
  return apiFetch('/api/calificaciones/pendientes');
}
