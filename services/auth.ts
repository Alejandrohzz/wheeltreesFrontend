import { apiFetch } from './api';
import { RolUsuario } from './types';

/** Dominio institucional fijo: el usuario solo escribe la parte antes de la @. */
export const DOMINIO_CORREO = '@unbosque.edu.co';

/**
 * Arma el email institucional a partir de lo que el usuario escribió.
 * Si por costumbre escribe el correo completo (o cualquier "algo@dominio"),
 * toma solo la parte antes de la @ y le pega el dominio institucional.
 */
export function construirEmailDesdeUsuario(usuario: string): string {
  const limpio = usuario.trim().toLowerCase();
  const soloUsuario = limpio.includes('@') ? limpio.split('@')[0] : limpio;
  return `${soloUsuario}${DOMINIO_CORREO}`;
}

/** Extrae la parte de usuario (sin dominio) de un email institucional, para prellenar el campo. */
export function extraerUsuarioDeEmail(email: string): string {
  return email.split('@')[0];
}

export interface RegistroRequest {
  nombre:   string;
  apellido: string;
  email:    string;
  password: string;
  rol:      RolUsuario;
  // Direcciones opcionales al registrarse (también se pueden agregar después
  // desde el perfil).
  direccionCasa?:    string;
  casaLat?:           number;
  casaLng?:           number;
  direccionTrabajo?: string;
  trabajoLat?:        number;
  trabajoLng?:        number;
}

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface VerificarEmailRequest {
  email:     string;
  codigoOtp: string;
}

export interface UsuarioResponse {
  id:                string;
  nombre:            string;
  apellido:          string;
  email:             string;
  rol:               string;
  fotoPerfil:        string | null;
  direccionCasa?:    string | null;
  direccionTrabajo?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  tipo:        string;
  usuario:     UsuarioResponse;
}

export interface MensajeResponse {
  mensaje: string;
  exito:   boolean;
}

/** POST /api/auth/registrar */
export const registro = (body: RegistroRequest) =>
  apiFetch<MensajeResponse>('/api/auth/registrar', {
    method: 'POST',
    body:   JSON.stringify(body),
  });

/** POST /api/auth/verificar-email */
export const verificarEmail = (body: VerificarEmailRequest) =>
  apiFetch<MensajeResponse>('/api/auth/verificar-email', {
    method: 'POST',
    body:   JSON.stringify(body),
  });

/** POST /api/auth/reenviar-otp?email=... */
export const reenviarOtp = (email: string) =>
  apiFetch<MensajeResponse>(`/api/auth/reenviar-otp?email=${encodeURIComponent(email)}`, {
    method: 'POST',
  });

/** POST /api/auth/login */
export const login = (body: LoginRequest) =>
  apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body:   JSON.stringify(body),
  });