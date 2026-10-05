const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface PlacePrediction {
  placeId:      string;
  description:  string;
  mainText:     string;
  secondaryText: string;
}

export interface PlaceLatLng {
  lat: number;
  lng: number;
}

/**
 * Área metropolitana de Bogotá (Bogotá D.C. + municipios aledaños: Soacha,
 * Chía, Cajicá, Zipaquirá, Funza, Mosquera, Madrid, Facatativá, Cota, Tenjo,
 * La Calera, Sopó, Tocancipá, etc.). Se aproxima con un rectángulo.
 * Ajusta estos valores si quieres hacerla más estrecha o más amplia.
 */
export const AREA_METROPOLITANA = {
  latMin: 4.45,
  latMax: 5.05,
  lngMin: -74.40,
  lngMax: -73.90,
  // Círculo que envuelve el rectángulo (para el autocompletado de Google).
  centro: { lat: 4.75, lng: -74.15 },
  radioMetros: 45000,
};

/** ¿La coordenada está dentro del área metropolitana de Bogotá? */
export function dentroAreaMetropolitana(p: PlaceLatLng): boolean {
  const a = AREA_METROPOLITANA;
  return p.lat >= a.latMin && p.lat <= a.latMax && p.lng >= a.lngMin && p.lng <= a.lngMax;
}

/**
 * Autocompletado de direcciones (Google Places Autocomplete, legacy API).
 * Restringido al área metropolitana de Bogotá.
 */
export async function autocompletePlaces(
  input: string,
  sessionToken: string
): Promise<PlacePrediction[]> {
  if (!input.trim()) return [];

  const params = new URLSearchParams({
    input,
    key: API_KEY,
    sessiontoken: sessionToken,
    language: 'es',
    components: 'country:co',
    location: `${AREA_METROPOLITANA.centro.lat},${AREA_METROPOLITANA.centro.lng}`,
    radius: String(AREA_METROPOLITANA.radioMetros),
    strictbounds: 'true', // solo sugerencias dentro del área metropolitana
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
  );
  const data = await res.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message ?? `Places API error: ${data.status}`);
  }

  return (data.predictions ?? []).map((p: any) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? '',
  }));
}

/** Obtiene lat/lng a partir de un place_id */
export async function getPlaceLatLng(placeId: string): Promise<PlaceLatLng> {
  const params = new URLSearchParams({
    place_id: placeId,
    key: API_KEY,
    fields: 'geometry',
    language: 'es',
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
  );
  const data = await res.json();

  if (data.status !== 'OK') {
    throw new Error(data.error_message ?? `Places API error: ${data.status}`);
  }

  const loc = data.result.geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}
