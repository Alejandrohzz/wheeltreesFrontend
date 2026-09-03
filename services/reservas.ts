import { apiFetch } from './api';

export interface SolicitarReservaRequest {
  viajeId:        string;
  notasPasajero?: string;
}

export interface Reserva {
  id:              string;
  viajeId:         string;
  origenViaje:     string;
  fechaHoraSalida: string; // ISO 8601
  pasajeroId:      string;
  pasajeroNombre:  string;
  pasajeroEmail:   string;
  conductorId:     string;
  conductorNombre: string;
  estado:          string; // PENDIENTE | CONFIRMADA | RECHAZADA | CANCELADA | COMPLETADA
  // null = el conductor aún no decide, true = abordó, false = no se presentó.
  // Solo tiene sentido una vez el viaje está EN_CURSO.
  abordo:          boolean | null;
  notasPasajero?:  string;
  creadoEn:        string; // ISO 8601
}

/** POST /api/reservas — el pasajero autenticado solicita un cupo en el viaje */
export const solicitarReserva = (body: SolicitarReservaRequest) =>
  apiFetch<Reserva>('/api/reservas', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** PATCH /api/reservas/{id}/responder — el conductor acepta o rechaza una reserva */
export const responderReserva = (reservaId: string, aceptar: boolean) =>
  apiFetch<Reserva>(`/api/reservas/${reservaId}/responder`, {
    method: 'PATCH',
    body: JSON.stringify({ aceptar }),
  });

/** PATCH /api/reservas/{id}/cancelar — el pasajero cancela su propia reserva */
export const cancelarReserva = (reservaId: string) =>
  apiFetch<Reserva>(`/api/reservas/${reservaId}/cancelar`, { method: 'PATCH' });

/** GET /api/reservas/mis-reservas — reservas del pasajero autenticado */
export const misReservas = () =>
  apiFetch<Reserva[]>('/api/reservas/mis-reservas');

/** GET /api/reservas/viaje/{viajeId} — reservas de un viaje (solo el conductor dueño) */
export const reservasDeViaje = (viajeId: string) =>
  apiFetch<Reserva[]>(`/api/reservas/viaje/${viajeId}`);

/**
 * PATCH /api/reservas/{id}/abordo — el conductor confirma si el pasajero
 * abordó o no. Solo funciona con el viaje EN_CURSO y reservas CONFIRMADA.
 */
export const marcarAbordo = (reservaId: string, abordo: boolean) =>
  apiFetch<Reserva>(`/api/reservas/${reservaId}/abordo`, {
    method: 'PATCH',
    body: JSON.stringify({ abordo }),
  });
