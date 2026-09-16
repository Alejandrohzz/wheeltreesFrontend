// Debe coincidir con el enum RolUsuario.java
export type RolUsuario = 'CONDUCTOR' | 'PASAJERO' | 'AMBOS';

// Debe coincidir con el enum TipoVehiculo.java
export type TipoVehiculo = 'MOTO' | 'CARRO';

export interface Vehiculo {
  id:                  string;
  tipo:                TipoVehiculo;
  placa:               string;
  marca:               string;
  modelo:              string;
  anio:                number;
  color:               string;
  capacidadPasajeros:  number;
  cedulaPropietario:   string;
  fotoVehiculo?:       string | null;
  activo:              boolean;
  terminosAceptados:   boolean;
  terminosAceptadosEn?: string | null;
}

// Debe coincidir con el estado del viaje en el backend
export type EstadoViaje = 'ACTIVO' | 'COMPLETADO' | 'CANCELADO' | string;

export interface Viaje {
  id:                  string;
  conductorId:         string;
  conductorNombre:     string;
  vehiculoPlaca:       string;
  vehiculoDescripcion: string;
  origenDescripcion:   string;
  destinoDescripcion:  string;
  // Coordenadas opcionales: solo estarán presentes si el backend las
  // guarda y las devuelve. Se usan para pintar el viaje en el mapa de home.
  origenLat?:          number;
  origenLng?:          number;
  destinoLat?:         number;
  destinoLng?:         number;
  fechaHoraSalida:     string; // ISO 8601
  cuposDisponibles:    number;
  cuposTotales:        number;
  aportePorPasajero:   number;
  estado:              EstadoViaje;
  notas:               string;
  // Última posición GPS conocida del conductor (solo mientras EN_CURSO).
  ubicacionLat?:          number;
  ubicacionLng?:          number;
  ubicacionActualizadaEn?: string; // ISO 8601
}
