/**
 * Código de verificación de abordaje.
 *
 * Se deriva de forma determinística a partir del id de la reserva (UUID que
 * YA reciben tanto el pasajero como el conductor desde el backend), así que
 * ambos lados calculan el mismo código de 4 dígitos sin necesitar un
 * endpoint nuevo ni guardar nada adicional.
 *
 * Uso: el pasajero le muestra/dice su código al conductor al subir; el
 * conductor lo ingresa en "Viaje en curso" antes de marcarlo como "Abordó".
 * Esto evita que, por accidente (o de mala fe), se marque como abordada a
 * la persona equivocada.
 */
export function codigoVerificacion(reservaId: string): string {
  let hash = 0;
  for (let i = 0; i < reservaId.length; i++) {
    hash = (hash * 31 + reservaId.charCodeAt(i)) >>> 0;
  }
  const codigo = hash % 10000;
  return String(codigo).padStart(4, '0');
}
