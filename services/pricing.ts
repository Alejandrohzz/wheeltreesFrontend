/**
 * Cálculo del precio (aporte por pasajero) sugerido para un trayecto,
 * a partir de la distancia y duración reales que devuelve Directions API.
 *
 * Fórmula: tarifa base + costo por km + costo por minuto,
 * luego se recorta al rango [PRECIO_MIN, PRECIO_MAX] y se redondea
 * a un número "bonito" (múltiplo de REDONDEO) para que se vea como
 * un precio real (ej. $3.500, $6.000) y no un número arbitrario.
 */

// ── Parámetros del algoritmo (ajustables) ──────────────────────────────────
const TARIFA_BASE   = 1000;  // COP: costo fijo de "abrir" el trayecto
const COSTO_POR_KM  = 300;   // COP por kilómetro recorrido
const COSTO_POR_MIN = 40;    // COP por minuto de viaje

const PRECIO_MIN = 2000;   // nunca sugerir menos de esto
const PRECIO_MAX = 8000;   // tope duro pedido: nunca superar $8.000
const REDONDEO   = 500;    // redondea al múltiplo de 500 más cercano

export interface PrecioSugeridoInput {
  distanceMeters: number;
  durationSeconds: number;
}

/**
 * Devuelve el precio sugerido (en COP) para un trayecto, siempre entre
 * PRECIO_MIN y PRECIO_MAX (8.000 como máximo absoluto).
 */
export function calcularPrecioSugerido({
  distanceMeters,
  durationSeconds,
}: PrecioSugeridoInput): number {
  const km  = Math.max(0, distanceMeters) / 1000;
  const min = Math.max(0, durationSeconds) / 60;

  const bruto = TARIFA_BASE + km * COSTO_POR_KM + min * COSTO_POR_MIN;

  // Redondea al múltiplo de REDONDEO más cercano.
  const redondeado = Math.round(bruto / REDONDEO) * REDONDEO;

  // Recorta al rango permitido — el tope de 8.000 se respeta siempre,
  // sin importar qué tan larga sea la ruta.
  return Math.min(PRECIO_MAX, Math.max(PRECIO_MIN, redondeado));
}

/** Versión formateada en pesos colombianos, ej. "$ 5.500" */
export function formatearPrecioCOP(valor: number): string {
  return `$ ${valor.toLocaleString('es-CO')}`;
}
