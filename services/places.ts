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
 * Autocompletado de direcciones (Google Places Autocomplete, legacy API).
 * Sesgado a Bogotá/Colombia para resultados más relevantes.
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
    location: '4.711,-74.0721', // Bogotá
    radius: '50000',
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
