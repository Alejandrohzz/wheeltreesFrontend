const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface LatLng {
  latitude:  number;
  longitude: number;
}

export interface RouteInfo {
  coordinates:   LatLng[];
  distanceText:  string;
  durationText:  string;
  distanceMeters: number;
  durationSeconds: number;
}

/** Decodifica un polyline codificado de Google (algoritmo estándar) */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/** Obtiene la ruta, distancia y duración entre dos puntos (Google Directions API) */
export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteInfo> {
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    key: API_KEY,
    language: 'es',
    mode: 'driving',
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
  );
  const data = await res.json();

  if (data.status !== 'OK') {
    throw new Error(data.error_message ?? `Directions API error: ${data.status}`);
  }

  const route = data.routes[0];
  const leg = route.legs[0];

  return {
    coordinates: decodePolyline(route.overview_polyline.points),
    distanceText: leg.distance.text,
    durationText: leg.duration.text,
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
  };
}
