import { LatLng } from '@/services/directions';
import { distancia, rumbo } from '@/services/geo';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** Rumbo del vehículo calculado a partir de sus últimas posiciones. */
export function useRumbo(pos: LatLng | null): number {
  const prev = useRef<LatLng | null>(null);
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    if (!pos) { prev.current = null; return; }
    if (prev.current && distancia(prev.current, pos) > 4) {
      setHeading(rumbo(prev.current, pos));
      prev.current = pos;
    } else if (!prev.current) {
      prev.current = pos;
    }
  }, [pos?.latitude, pos?.longitude]);

  return heading;
}

/**
 * Interpola la posición entre dos actualizaciones del GPS para que el
 * vehículo se deslice por el mapa en vez de dar saltos cada 4 segundos.
 */
export function usePosicionSuave(destino: LatLng | null, duracionMs = 3500): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(destino);
  const actual = useRef<LatLng | null>(destino);

  useEffect(() => {
    if (!destino) { actual.current = null; setPos(null); return; }
    const desde = actual.current;
    if (!desde || distancia(desde, destino) > 500) {
      actual.current = destino;
      setPos(destino);
      return;
    }

    const inicio = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - inicio) / duracionMs);
      const p = {
        latitude: desde.latitude + (destino.latitude - desde.latitude) * k,
        longitude: desde.longitude + (destino.longitude - desde.longitude) * k,
      };
      actual.current = p;
      setPos(p);
      if (k >= 1) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [destino?.latitude, destino?.longitude, duracionMs]);

  return pos;
}

interface Padding { top: number; bottom: number }

/**
 * Cámara del mapa.
 *  - Antes de iniciar el viaje: encuadra los puntos clave (conductor, origen, destino).
 *  - Con el viaje en curso (`seguirPos` presente): sigue mi ubicación actual con
 *    zoom cercano, como un navegador.
 * Si el usuario mueve el mapa con el dedo deja de seguir y aparece el botón
 * para recentrar.
 */
export function useCamara(
  mapRef: RefObject<any>,
  puntos: LatLng[],
  padding: Padding,
  listo: boolean,
  seguirPos: LatLng | null = null,
) {
  const [siguiendo, setSiguiendo] = useState(true);
  const clave = puntos.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join('|');
  const modoSeguir = !!seguirPos;
  const claveSeguir = seguirPos
    ? `${seguirPos.latitude.toFixed(5)},${seguirPos.longitude.toFixed(5)}`
    : '';

  const encuadrar = useCallback(() => {
    if (!mapRef.current) return;

    if (seguirPos) {
      mapRef.current.animateCamera(
        { center: seguirPos, zoom: 17, altitude: 1500, pitch: 0 },
        { duration: 800 },
      );
      return;
    }

    if (puntos.length === 0) return;
    if (puntos.length === 1) {
      mapRef.current.animateToRegion(
        { ...puntos[0], latitudeDelta: 0.012, longitudeDelta: 0.012 }, 600);
    } else {
      mapRef.current.fitToCoordinates(puntos, {
        edgePadding: { top: padding.top + 60, right: 60, bottom: padding.bottom + 40, left: 60 },
        animated: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, claveSeguir, padding.top, padding.bottom]);

  // Al empezar a seguir mi ubicación (viaje iniciado) se vuelve a activar el seguimiento.
  useEffect(() => {
    if (modoSeguir) setSiguiendo(true);
  }, [modoSeguir]);

  useEffect(() => {
    if (listo && siguiendo) encuadrar();
  }, [clave, claveSeguir, listo, siguiendo, padding.bottom, encuadrar]);

  return {
    siguiendo,
    onPanDrag: () => setSiguiendo(false),
    recentrar: () => { setSiguiendo(true); encuadrar(); },
  };
}
