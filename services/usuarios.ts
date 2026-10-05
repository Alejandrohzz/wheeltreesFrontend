import { apiFetch } from './api';
import { UsuarioResponse } from './auth';
import { RolUsuario } from './types';

export interface PerfilResponse extends UsuarioResponse {
  emailVerificado: boolean;
  direccionCasa?:    string | null;
  casaLat?:           number | null;
  casaLng?:           number | null;
  direccionTrabajo?: string | null;
  trabajoLat?:        number | null;
  trabajoLng?:        number | null;
  calificacionPromedio?: number | null;
  totalCalificaciones?:  number | null;
}

export interface ActualizarPerfilRequest {
  nombre:    string;
  apellido:  string;
  fotoPerfil?: string | null;
  direccionCasa?:    string | null;
  casaLat?:           number | null;
  casaLng?:           number | null;
  direccionTrabajo?: string | null;
  trabajoLat?:        number | null;
  trabajoLng?:        number | null;
}

/** GET /api/usuarios/me — perfil del usuario autenticado (requiere token válido en el header). */
export const obtenerMiPerfil = () =>
  apiFetch<PerfilResponse>('/api/usuarios/me');

/**
 * PATCH /api/usuarios/me/fcm-token — registra el push token de Expo del
 * dispositivo actual, para que el backend pueda mandar notificaciones
 * push reales (nueva solicitud, reserva confirmada/rechazada, viaje
 * cancelado, recordatorio 15 min antes de salir).
 */
export const registrarPushToken = (fcmToken: string) =>
  apiFetch<void>('/api/usuarios/me/fcm-token', {
    method: 'PATCH',
    body:   JSON.stringify({ fcmToken }),
  });

/**
 * PUT /api/usuarios/me — reemplaza el perfil completo. El backend exige
 * nombre/apellido siempre, así que quien solo quiera actualizar una
 * dirección debe mandar también los datos actuales de nombre/apellido
 * (ya los tiene a mano si cargó el perfil primero).
 */
export const actualizarPerfil = (body: ActualizarPerfilRequest) =>
  apiFetch<PerfilResponse>('/api/usuarios/me', {
    method: 'PUT',
    body:   JSON.stringify(body),
  });

/**
 * PATCH /api/usuarios/me/rol — cambia el rol del usuario (CONDUCTOR o PASAJERO).
 * El backend solo acepta estos dos valores: es el único cambio que decide si
 * la cuenta puede publicar viajes y registrar vehículos (conductor) o solo
 * ver y reservar viajes disponibles (pasajero).
 */
export const actualizarRol = (rol: Extract<RolUsuario, 'CONDUCTOR' | 'PASAJERO'>) =>
  apiFetch<PerfilResponse>('/api/usuarios/me/rol', {
    method: 'PATCH',
    body:   JSON.stringify({ rol }),
  });

/** Atajo para guardar solo la dirección de casa, sin tocar el resto del perfil. */
export const guardarDireccionCasa = async (
  direccion: string,
  lat: number,
  lng: number,
) => {
  const actual = await obtenerMiPerfil();
  return actualizarPerfil({
    nombre: actual.nombre,
    apellido: actual.apellido,
    fotoPerfil: actual.fotoPerfil,
    direccionCasa: direccion,
    casaLat: lat,
    casaLng: lng,
    direccionTrabajo: actual.direccionTrabajo,
    trabajoLat: actual.trabajoLat,
    trabajoLng: actual.trabajoLng,
  });
};

/** Atajo para guardar solo la dirección de trabajo/estudio, sin tocar el resto. */
export const guardarDireccionTrabajo = async (
  direccion: string,
  lat: number,
  lng: number,
) => {
  const actual = await obtenerMiPerfil();
  return actualizarPerfil({
    nombre: actual.nombre,
    apellido: actual.apellido,
    fotoPerfil: actual.fotoPerfil,
    direccionCasa: actual.direccionCasa,
    casaLat: actual.casaLat,
    casaLng: actual.casaLng,
    direccionTrabajo: direccion,
    trabajoLat: lat,
    trabajoLng: lng,
  });
};
