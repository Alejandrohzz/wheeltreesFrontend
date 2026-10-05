// Misma paleta que el resto de la app (home, perfil, viajes…).
export const TRACK_DARK = {
  bg:        '#131517',   // fondo de pantalla / barra superior
  sheet:     '#1E2126',   // panel inferior, etiquetas
  card:      '#171A1E',   // tarjetas dentro del panel
  chip:      '#2A2F36',
  border:    '#2E343C',
  text:      '#FFFFFF',
  textSub:   '#9BA3AD',
  textMuted: '#6B7785',
  route:     '#3DBE7A',   // ruta pendiente: verde
  routeDone: '#4B5560',   // ruta ya recorrida
  origin:    '#9B7BD9',   // icono de origen (morado, como en el resto de la app)
  accent:    '#4A90D9',
  green:     '#3DBE7A',
  red:       '#E05C5C',
  amber:     '#E0B84C',
  orange:    '#F5821F',
  onAccent:  '#FFFFFF',
};

export const TRACK_LIGHT = {
  bg:        '#F5F7F8',
  sheet:     '#FFFFFF',
  card:      '#F5F7F8',
  chip:      '#EAEEF1',
  border:    '#DDE1E6',
  text:      '#11181C',
  textSub:   '#5B6472',
  textMuted: '#7A8593',
  route:     '#2FAE6B',
  routeDone: '#B6BEC7',
  origin:    '#8A66D0',
  accent:    '#4A90D9',
  green:     '#2FAE6B',
  red:       '#E05C5C',
  amber:     '#C9992B',
  orange:    '#F5821F',
  onAccent:  '#FFFFFF',
};

export type TrackColors = typeof TRACK_DARK;

export const MAP_DARK = [
  { elementType: 'geometry',           stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road',         elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'water',        elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'poi',          stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',      stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape',    elementType: 'geometry', stylers: [{ color: '#1c1c1c' }] },
];

// Mapa claro y limpio (sin negocios ni transporte público) para que la ruta resalte.
export const MAP_LIGHT = [
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road',    elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];
