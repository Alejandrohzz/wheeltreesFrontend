import { apiFetch, clearToken, saveToken } from './api';
import { construirEmailDesdeUsuario } from './auth';

// ── Sesión de admin ──────────────────────────────────────────────────────
// El login ahora se valida en el backend (POST /api/admin/login) y el token
// de admin se guarda como el de cualquier usuario. La contraseña ya NO vive
// dentro de la app.
export const ADMIN_EMAIL = 'admin@unbosque.edu.co';

/** ¿Lo escrito en el login corresponde a la cuenta de admin? Acepta "admin" o "admin@unbosque.edu.co". */
export function esUsuarioAdmin(usuario: string): boolean {
  return construirEmailDesdeUsuario(usuario) === ADMIN_EMAIL;
}

let adminActivo = false;

/** Valida las credenciales en el backend y guarda el token de admin. Lanza error si son incorrectas. */
export async function loginAdmin(usuario: string, password: string): Promise<void> {
  const res = await apiFetch<{ accessToken: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: construirEmailDesdeUsuario(usuario), password }),
  });
  await saveToken(res.accessToken);
  adminActivo = true;
}

export const cerrarSesionAdmin = () => { adminActivo = false; clearToken().catch(() => {}); };
export const hayAdminActivo    = () => adminActivo;

// ── Tipos ────────────────────────────────────────────────────────────────

export interface Autor {
  id?:       string;
  nombre?:   string;
  apellido?: string;
  email?:    string;
}

export interface Reporte {
  id:        string;
  texto:     string;
  autor:     Autor;
  creadoEn:  string; // ISO 8601
  resuelto:  boolean;
  /** Conductor reportado (solo si el reporte viene ligado a un viaje). */
  reportado?: (Autor & { cuentaActiva: boolean }) | null;
  viaje?:     { id: string; origen: string; fechaHoraSalida: string } | null;
}

interface ReporteApi {
  id: string; texto: string;
  autorId: string; autorNombre: string; autorEmail: string;
  reportadoId?: string | null; reportadoNombre?: string | null; reportadoEmail?: string | null;
  reportadoCuentaActiva?: boolean | null;
  viajeId?: string | null; viajeOrigen?: string | null; viajeFechaHoraSalida?: string | null;
  resuelto: boolean; creadoEn: string;
}

const desdeApi = (r: ReporteApi): Reporte => ({
  id: r.id,
  texto: r.texto,
  autor: { id: r.autorId, nombre: r.autorNombre, email: r.autorEmail },
  creadoEn: r.creadoEn,
  resuelto: r.resuelto,
  reportado: r.reportadoId
    ? { id: r.reportadoId, nombre: r.reportadoNombre ?? undefined, email: r.reportadoEmail ?? undefined,
        cuentaActiva: r.reportadoCuentaActiva !== false }
    : null,
  viaje: r.viajeId
    ? { id: r.viajeId, origen: r.viajeOrigen ?? '', fechaHoraSalida: r.viajeFechaHoraSalida ?? '' }
    : null,
});

export type EstadoVehiculoAdmin = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

/** Resumen para la lista (sin fotos). */
export interface VehiculoAdminResumen {
  id: string; placa: string; marca: string; modelo: string; anio: number; tipo: string;
  estadoVerificacion: EstadoVehiculoAdmin;
  conductorNombre: string; conductorEmail: string; creadoEn?: string | null;
}

/** Detalle con cédula y fotos de los documentos (data URI base64 o URL). */
export interface VehiculoAdminDetalle extends VehiculoAdminResumen {
  color: string; capacidadPasajeros: number; cedulaPropietario: string;
  fotoVehiculo?: string | null; fotoLicencia?: string | null; fotoTarjetaPropiedad?: string | null;
  terminosAceptados: boolean; motivoRechazo?: string | null;
  revisadoPor?: string | null; revisadoEn?: string | null; conductorId: string;
}

// ── Verificación manual de vehículos (backend) ──────────────────────────

/** GET /api/admin/vehiculos?estado=PENDIENTE|APROBADO|RECHAZADO */
export const listarVehiculosAdmin = (estado: EstadoVehiculoAdmin) =>
  apiFetch<VehiculoAdminResumen[]>(`/api/admin/vehiculos?estado=${estado}`);

/** GET /api/admin/vehiculos/{id} — incluye las fotos de los documentos. */
export const detalleVehiculoAdmin = (id: string) =>
  apiFetch<VehiculoAdminDetalle>(`/api/admin/vehiculos/${id}`);

export const aprobarVehiculoAdmin = (id: string) =>
  apiFetch<VehiculoAdminDetalle>(`/api/admin/vehiculos/${id}/aprobar`, { method: 'PATCH' });

export const rechazarVehiculoAdmin = (id: string, motivo: string) =>
  apiFetch<VehiculoAdminDetalle>(`/api/admin/vehiculos/${id}/rechazar`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo }),
  });

// ── Reportes y moderación de usuarios (backend) ─────────────────────────
// Las rutas exactas dependen del controlador Spring. Para no bloquear la app
// mientras se confirman, cada operación prueba varias rutas probables y
// recuerda la que funcionó. Cuando sepas la ruta real, deja solo esa en la lista.

interface Intento { method: 'GET' | 'POST' | 'PUT' | 'PATCH'; path: string; body?: unknown }

const rutaOk: Record<string, Intento> = {};

/** ¿El error significa "esta ruta no existe" (y no un fallo real de negocio)? */
const rutaInexistente = (e: any) =>
  /No static resource|Error 404|Error 405|not supported|Not Found/i.test(e?.message ?? '');

async function probar<T>(clave: string, intentos: Intento[]): Promise<T> {
  const lista = rutaOk[clave] ? [rutaOk[clave], ...intentos] : intentos;
  let ultimo: unknown;
  for (const it of lista) {
    try {
      const res = await apiFetch<T>(it.path, {
        method: it.method,
        ...(it.body !== undefined ? { body: JSON.stringify(it.body) } : {}),
      });
      rutaOk[clave] = it;
      if (__DEV__) console.log(`✓ [${clave}] ruta válida:`, it.method, it.path);
      return res;
    } catch (e) {
      ultimo = e;
      if (!rutaInexistente(e)) throw e;
    }
  }
  throw ultimo;
}

/** Crea un reporte (usuario normal). viajeId es opcional. */
export const crearReporte = async (texto: string, viajeId?: string): Promise<Reporte> => {
  const body = { texto, ...(viajeId ? { viajeId } : {}) };
  const r = await probar<ReporteApi>('crear', [
    { method: 'POST', path: '/api/reportes', body },
    { method: 'POST', path: '/api/reportes/crear', body },
    { method: 'POST', path: '/api/usuarios/reportes', body },
    { method: 'POST', path: '/api/admin/reportes', body },
  ]);
  return desdeApi(r);
};

/** Lista todos los reportes (admin). */
export const listarReportes = async (): Promise<Reporte[]> => {
  const lista = await apiFetch<ReporteApi[]>('/api/admin/reportes');
  return (Array.isArray(lista) ? lista : []).map(desdeApi);
};

/** Marca/desmarca un reporte como resuelto. */
export const marcarReporteResuelto = (id: string, resuelto: boolean) => {
  const b = { resuelto };
  const base = `/api/admin/reportes/${id}`;
  return probar<unknown>('resolver', [
    { method: 'PATCH', path: `${base}/resolver`, body: b },
    { method: 'PUT',   path: `${base}/resolver`, body: b },
    { method: 'PATCH', path: `${base}`,          body: b },
    { method: 'PUT',   path: `${base}`,          body: b },
    { method: 'PATCH', path: `${base}/resuelto`, body: b },
    { method: 'PUT',   path: `${base}/resuelto`, body: b },
    { method: 'PATCH', path: `${base}/resolver` },
    { method: 'PATCH', path: `${base}/toggle` },
  ]);
};

/** Banea (desactiva) la cuenta de un usuario. */
export const banearUsuario = (id: string) =>
  probar<unknown>('banear', [
    { method: 'PATCH', path: `/api/admin/usuarios/${id}/banear` },
    { method: 'PUT',   path: `/api/admin/usuarios/${id}/banear` },
    { method: 'POST',  path: `/api/admin/usuarios/${id}/banear` },
    { method: 'PATCH', path: `/api/admin/usuarios/${id}/desactivar` },
    { method: 'PATCH', path: `/api/admin/usuarios/${id}/bloquear` },
  ]);

/** Reactiva la cuenta de un usuario baneado. */
export const desbanearUsuario = (id: string) =>
  probar<unknown>('desbanear', [
    { method: 'PATCH', path: `/api/admin/usuarios/${id}/desbanear` },
    { method: 'PUT',   path: `/api/admin/usuarios/${id}/desbanear` },
    { method: 'POST',  path: `/api/admin/usuarios/${id}/desbanear` },
    { method: 'PATCH', path: `/api/admin/usuarios/${id}/activar` },
    { method: 'PATCH', path: `/api/admin/usuarios/${id}/desbloquear` },
  ]);
