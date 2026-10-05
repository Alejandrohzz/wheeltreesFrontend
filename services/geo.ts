import { LatLng } from './directions';

const R_TIERRA = 6371000;
const rad = (g: number) => (g * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Distancia en metros entre dos puntos (haversine). */
export function distancia(a: LatLng, b: LatLng): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumbo (0-360°, 0 = norte) para ir de a hacia b. */
export function rumbo(a: LatLng, b: LatLng): number {
  const dLng = rad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(rad(b.latitude));
  const x =
    Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude)) -
    Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(dLng);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export interface RutaDividida {
  /** Tramo ya recorrido (del inicio de la ruta hasta el punto actual). */
  recorrido: LatLng[];
  /** Tramo que falta (desde el punto actual hasta el final). */
  restante: LatLng[];
  metrosRestantes: number;
}

/**
 * Divide la ruta en "recorrido" y "restante" según la posición actual
 * (vértice más cercano). Es lo que permite pintar la ruta como Uber:
 * gris lo que ya pasó, negro lo que falta.
 */
export function dividirRuta(ruta: LatLng[], p: LatLng | null): RutaDividida {
  if (ruta.length === 0) return { recorrido: [], restante: [], metrosRestantes: 0 };
  if (!p) {
    let m = 0;
    for (let i = 1; i < ruta.length; i++) m += distancia(ruta[i - 1], ruta[i]);
    return { recorrido: [], restante: ruta, metrosRestantes: m };
  }

  let idx = 0;
  let mejor = Infinity;
  for (let i = 0; i < ruta.length; i++) {
    const d = distancia(p, ruta[i]);
    if (d < mejor) { mejor = d; idx = i; }
  }

  const siguiente = Math.min(idx + 1, ruta.length - 1);
  const restante = [p, ...ruta.slice(siguiente)];
  const recorrido = [...ruta.slice(0, siguiente), p];

  let metros = 0;
  for (let i = 1; i < restante.length; i++) metros += distancia(restante[i - 1], restante[i]);
  return { recorrido, restante, metrosRestantes: metros };
}

/** "7 min", "1 h 5 min" */
export function formatearEta(segundos: number): string {
  const m = Math.max(1, Math.round(segundos / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** "350 m", "4.2 km" */
export function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.max(10, Math.round(metros / 10) * 10)} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}

/** Hora estimada de llegada a partir de ahora, p. ej. "2:35 p. m." */
export function horaLlegada(segundos: number): string {
  return new Date(Date.now() + segundos * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}
