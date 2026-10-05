import { apiFetch } from './api';
import { getTerminos, terminosComoTexto, TERMINOS_VERSION } from '@/constants/terminos';

/**
 * Envía al correo institucional del usuario autenticado la copia de los
 * términos y condiciones que acaba de aceptar.
 *
 * POST /api/terminos/enviar  { version, idioma, asunto, texto }
 * El backend toma el destinatario del usuario autenticado (no del body).
 */
export const enviarTerminosPorCorreo = (idioma: string = 'es') => {
  const t = getTerminos(idioma);
  return apiFetch<unknown>('/api/terminos/enviar', {
    method: 'POST',
    body: JSON.stringify({
      version: TERMINOS_VERSION,
      idioma: idioma.toLowerCase().startsWith('en') ? 'en' : 'es',
      asunto: `WheelTrees — ${t.titulo}`,
      texto: terminosComoTexto(idioma),
    }),
  });
};
