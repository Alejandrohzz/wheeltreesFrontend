# WheelTrees

Cliente móvil de WheelTrees, aplicación de carpooling para la comunidad de la Universidad El Bosque.

Implementado con **Expo Router + React Native + TypeScript**. Consume una API REST en Spring Boot (repositorio aparte).

> **Alcance de este documento.** Está construido a partir de las pantallas del directorio `app/`

> (el zip recibido contiene solo esa carpeta). Los módulos `services/`, `context/`, `contexts/`, `components/`,

> `hooks/`, `constants/` e `i18n` se documentan por **uso** (imports y llamadas). Donde un dato depende de código

> que no está en el zip (URLs de endpoints, nombres de variables de entorno) se marca como **[completar]**.

---

## 1. Stack
| Área | Tecnología |
|---|---|
| Framework | Expo, Expo Router (enrutamiento por archivos), React Native, TypeScript |
| Mapas / ubicación | `react-native-maps` (Google en Android, proveedor por defecto en iOS), `expo-location` |
| Medios | `expo-image-picker` (cámara y galería), `expo-image` |
| Fecha/hora | `@react-native-community/datetimepicker` |
| i18n | `i18next` + `react-i18next` |
| Animaciones / layout | `react-native-reanimated`, `react-native-safe-area-context` |
| Iconos | `@expo/vector-icons` |
| Push | Notificaciones push (`services/notifications`) |
| Backend | Spring Boot 3.3 + JPA/Hibernate + SQL Server, JWT |
## 2. Requisitos y ejecución

- Node.js LTS y npm

- Android Studio (emulador), simulador iOS (macOS) o Expo Go

- Backend accesible desde el dispositivo

- Claves de Google Maps / Places / Directions

```bash
npm install
npx expo start            # desarrollo
npx expo start --clear    # limpia caché de Metro
```

Mapas y push completos requieren **development build**; Expo Go no los soporta del todo.

### Configuración **[completar]**

Los valores se centralizan en `services/` (no incluido en el zip). Debes definir:
| Valor | Consumido por |
|---|---|
| URL base de la API | todos los servicios REST |
| Clave de Google Maps (Android) | `react-native-maps` |
| Clave de Places / Directions | `services/places`, `services/directions` |
No versionar claves.

## 3. Arquitectura del cliente

```
app/            Pantallas y rutas (Expo Router)
services/       Acceso a API y lógica de dominio (auth, viajes, reservas, vehiculos, usuarios,
                admin, chat, notifications, calificaciones, contadores, places, directions,
                geo, pricing, biometrics, tripTimer, verificationCode, terminos, types)
context/        AuthContext (sesión de usuario)
contexts/       ThemeContext, LanguageContext
components/     atoms (SlideToConfirm), tracking/\*, CalificarModal, BiometricUnlockModal,
                PlaceAutocompleteInput, BadgeContador, themed-\*, ui/\*
hooks/          use-color-scheme, useUbicacionViaje, useContadores
constants/      theme, terminos, modelosVehiculos
i18n            Inicialización de i18next (import '@/i18n')
```

Alias de importación: `@/` apunta a la raíz del proyecto.

### Proveedores raíz (`app/\_layout.tsx`)

Orden de anidamiento:

```
SafeAreaProvider
 └─ AppThemeProvider      (tema claro/oscuro/sistema)
     └─ LanguageProvider  (idioma)
         └─ AuthProvider  (sesión)
             └─ AppShell  (Stack + splash 800 ms + push)
```

`AppShell`:

- Con sesión (`usuario.id`) llama `registrarNotificacionesPush()`, que pide permiso, obtiene el token del dispositivo y lo registra en el backend.

- Suscribe un listener de toques sobre notificaciones y navega según `data.tipo` (ver §6).

- Muestra un `SplashOverlay` de 800 ms sobre el stack.

### Patrón de pantalla

- Estilos por pantalla con `createStyles(C)` y paletas `DARK_C` / `LIGHT_C` definidas **dentro de cada archivo**; se elige con `useAppTheme().isDark`.

- Textos con `useTranslation()` (`t('modulo.clave')`).

- Formularios: validación local con función `validar()` que devuelve el mensaje de error o `null`; el botón de guardar se bloquea hasta cumplir condiciones (referencia: `vehicle-form.tsx`).

## 4. Mapa de rutas

Todas con `headerShown: false` salvo `modal`.
| Ruta | Archivo | Params | Servicios principales | Notas |
|---|---|---|---|---|
| `/login` | `login.tsx` | – | `auth`, `admin` (`loginAdmin`, `esUsuarioAdmin`), `biometrics` | Redirige a `/home` o `/admin` |
| `/register` | `register.tsx` | – | `auth` (`registro`, `verificarEmail`, `reenviarOtp`) | 2 pasos: `form` → `otp` |
| `/forgot-password` | `forgot-password.tsx` | – | `auth` (`solicitarRecuperacion`, `verificarCodigoRecuperacion`, `restablecerPassword`) | |
| `/home` | `home.tsx` | – | `viajes`, `reservas`, `calificaciones`, `directions`, `useContadores`, `useUbicacionViaje` | Mapa principal; \~1900 líneas |
| `/profile` | `profile.tsx` | – | `usuarios` (`obtenerMiPerfil`, `actualizarPerfil`, `actualizarRol`), `places` | Rol, direcciones, tema, idioma, logout |
| `/vehicles` | `vehicles.tsx` | – | `vehiculos` (`listarVehiculos`, `desactivarVehiculo`) | |
| `/vehicle-form` | `vehicle-form.tsx` | `id?` | `vehiculos`, `terminos`, `constants/modelosVehiculos` | `presentation: 'modal'`; `id` = edición |
| `/publish-trip` | `publish-trip.tsx` | `origenDescripcion?` y otros (ver código) | `viajes.crearViaje`, `vehiculos`, `usuarios`, `places`, `directions`, `pricing` | `presentation: 'modal'` |
| `/available-trips` | `available-trips.tsx` | – | `viajes.listarViajes`, `reservas.solicitarReserva`, `directions` | Lista + mapa con filtros |
| `/my-trips` | `my-trips.tsx` | – | `viajes` (`listarMisViajes`, `cancelarViaje`) | Conductor |
| `/my-reservations` | `my-reservations.tsx` | – | `reservas` (`misReservas`, `cancelarReserva`), `verificationCode` | Pasajero |
| `/notifications` | `notifications.tsx` | – | `reservas` (`reservasDeViaje`, `responderReserva`), `contadores.marcarVistos` | Solicitudes al conductor |
| `/start-trip` | `start-trip.tsx` | `viajeId` | `viajes` (`detalleViaje`, `iniciarViaje`), `tripTimer`, `SlideToConfirm` | `gestureEnabled: false` |
| `/trip-in-progress` | `trip-in-progress.tsx` | `viajeId` | `viajes`, `reservas.marcarAbordo`, `geo`, `tripTimer`, `verificationCode`, `components/tracking/\*` | Conductor |
| `/trip-tracking` | `trip-tracking.tsx` | `viajeId` | `viajes.detalleViaje`, `reservas.misReservas`, `geo`, `components/tracking/\*` | Pasajero |
| `/chats` | `chats.tsx` | – | `chat.misChats` | |
| `/chat` | `chat.tsx` | `otroUsuarioId`, `otroUsuarioNombre` | `chat`, `notifications.setChatAbierto` | |
| `/help` | `help.tsx` | – | `admin.crearReporte`, `reservas.misReservas` | Reporte de incidentes |
| `/terms` | `terms.tsx` | – | `constants/terminos.getTerminos` | |
| `/admin` | `admin.tsx` | – | `admin` | `gestureEnabled: false`; pestañas `reportes` / `vehiculos` |
| `(tabs)`, `/modal` | `(tabs)/\*`, `modal.tsx` | – | – | Plantilla de Expo; **sin uso funcional** |
### Flujos de navegación

```
login ──► home ──► profile ──► vehicles ──► vehicle-form(id?) ──► terms
  │         ├────► publish-trip            (conductor)
  │         ├────► available-trips         (pasajero)
  │         ├────► my-trips ──► start-trip ──► trip-in-progress   (conductor)
  │         ├────► my-reservations ──► trip-tracking              (pasajero)
  │         ├────► notifications | chats ──► chat
  │         └────► help
  └──► admin  (cuenta administradora; replace → /login al salir)
```

## 5. Autenticación y sesión

- **Registro:** `nombre`, `apellido`, usuario + dominio institucional (`DOMINIO_CORREO` en `services/auth`), contraseña ≥ 8 caracteres y confirmación. Después, OTP de **6 dígitos** (`verificarEmail({ email, codigoOtp })`) con opción de reenvío.

- **Login:** el usuario escribe solo la parte local; `construirEmailDesdeUsuario` arma el correo. Se llama `iniciarSesion({ email, password })` del `AuthContext`.

- **Administrador:** el mismo formulario; `esUsuarioAdmin` / `loginAdmin` validan contra un endpoint propio y se redirige a `/admin`.

- **Biometría (`services/biometrics`, `BiometricUnlockModal`):**

  - Se ofrece activarla tras el primer login si el dispositivo la soporta.

  - Se guarda el último usuario (`guardarUltimoUsuario` / `obtenerUltimoUsuario`).

  - **Bloqueo tras 3 intentos fallidos** (`obtenerEstadoBloqueoBiometrico` → `intentosFallidos`, `intentosRestantes`, `bloqueada`); el desbloqueo es por código enviado al correo.

  - Si hay sesión guardada y biometría activa, se intenta automáticamente una vez al abrir `login`.

- **Recuperación de contraseña:** solicitar → verificar código → restablecer; al terminar redirige a `/login` tras 1,8 s.

## 6. Notificaciones push

Mapeo de `data.tipo` → destino (`app/\_layout.tsx`):
| `tipo` | Destino |
|---|---|
| `nueva_solicitud`, `reserva_cancelada` | `/notifications` |
| `respuesta_reserva`, `reserva_confirmada`, `reserva_rechazada`, `viaje_cancelado`, `viaje_completado` | `/my-reservations` |
| `viaje_iniciado` | `/trip-tracking` con `viajeId` (si falta, `/home`) |
| `nuevo_mensaje` | `/chat` con `otroUsuarioId` y `otroUsuarioNombre` (si falta `remitenteId`, `/chats`) |
| `vehiculo_aprobado`, `vehiculo_rechazado` | `/vehicles` |
| `recordatorio_viaje` | `/home` |
`chat.tsx` llama `setChatAbierto` para que el servicio pueda suprimir notificaciones del chat que ya está visible.

## 7. Modelo de dominio (según uso en el cliente)

### Estados
| Entidad | Valores observados |
|---|---|
| Viaje | `PROGRAMADO` → `EN_CURSO` → `COMPLETADO` · `CANCELADO` |
| Reserva | `PENDIENTE` → `CONFIRMADA` → `COMPLETADA` · `RECHAZADA` · `CANCELADA` |
| Vehículo (admin) | `PENDIENTE`, `APROBADO`, `RECHAZADO` |
| Tipo de vehículo | `CARRO`, `MOTO` |
> `notifications.tsx` define `ESTADO_PENDIENTE`, `ESTADO_CANCELADA` y `ESTADO_COMPLETADA` como constantes; el resto de pantallas compara con literales. Unificarlo en `services/types` evitaría errores de tipeo.

### Operaciones por rol
| Rol | Operaciones |
|---|---|
| Pasajero | `listarViajes(filtros)`, `solicitarReserva({ viajeId, ... })`, `misReservas`, `cancelarReserva(id)`, `detalleViaje`, `obtenerPendientes` (calificaciones), `crearReporte` |
| Conductor | `crearViaje`, `listarMisViajes`, `cancelarViaje(id)`, `iniciarViaje(id)`, `completarViaje(id)`, `reservasDeViaje(viajeId)`, `responderReserva(id, aceptar)`, `marcarAbordo(reservaId, abordo)`, CRUD de vehículos |
| Administrador | `listarReportes`, `marcarReporteResuelto(id, resuelto)`, `banearUsuario` / `desbanearUsuario`, `listarVehiculosAdmin`, `detalleVehiculoAdmin`, `aprobarVehiculoAdmin(id)`, `rechazarVehiculoAdmin(id, motivo)` |
Todo usuario nace pasajero y cambia de rol con `actualizarRol(nuevoRol)` desde `/profile`.

## 8. Reglas de negocio aplicadas en el cliente

El backend también debe validarlas; el cliente las aplica como bloqueo preventivo.
| Regla | Valor | Archivo |
|---|---|---|
| Cancelar reserva | Solo `PENDIENTE`/`CONFIRMADA` y con ≥ **30 min** para la salida (`MINUTOS_LIMITE_CANCELACION`, ref. UR010) | `my-reservations.tsx` |
| Placa carro | `^[A-Z]{3}[0-9]{3}$` (ej. `ABC123`) | `vehicle-form.tsx` |
| Placa moto | `^[A-Z]{3}[0-9]{2}[A-Z]$` (ej. `ABC12D`) | `vehicle-form.tsx` |
| Entrada de placa | `formatearPlaca` filtra carácter por carácter según posición (L/N) | `vehicle-form.tsx` |
| Capacidad carro | 2 a 7 (`CAPACIDAD_MIN_CARRO`, `CAPACIDAD_MAX_CARRO`); moto: 1 | `vehicle-form.tsx` |
| Año del vehículo | `[añoActual − 19, añoActual + 1]` (máx. 20 años de antigüedad) | `vehicle-form.tsx` |
| Cédula propietario | `^[0-9]{6,10}$` | `vehicle-form.tsx` |
| Documentos | Foto de licencia y de tarjeta de propiedad obligatorias al **crear** (no al editar) | `vehicle-form.tsx` |
| Consentimientos | Aceptar términos y autorizar documentos | `vehicle-form.tsx` |
| Zona de publicación | Origen y destino dentro del área metropolitana (`dentroAreaMetropolitana`) | `publish-trip.tsx` |
| Cupos | Moto fija en 1; carro ≥ 1 y ≤ `capacidadPasajeros` del vehículo; valor por defecto `'4'` | `publish-trip.tsx` |
| Aporte | Máximo **COP 8.000**, o gratis; sugerido con `calcularPrecioSugerido` | `publish-trip.tsx` |
| Origen predefinido | Universidad El Bosque (`4.7103137, -74.0322043`) | `home.tsx`, `publish-trip.tsx` |
| Contraseña | ≥ 8 caracteres | `register.tsx` |
| OTP | 6 dígitos | `register.tsx` |
| Reporte | Comentario de 10 a 500 caracteres; puede asociarse a un viaje previo (`COMPLETADA`/`CONFIRMADA`) | `help.tsx` |
| Llegada al punto de encuentro | < `RADIO_LLEGADA_M` = **150 m** | `trip-tracking.tsx` |
## 9. Tiempo real, polling y ubicación
| Qué | Cómo | Frecuencia |
|---|---|---|
| Reservas activas (badge en home) | `setInterval(misReservas)` | 15 s |
| Detección de viaje en curso (home) | `setInterval(detectar)` | 10 s |
| Estado de reserva / abordo (pasajero) | `setInterval(cargarReserva)` | `REFRESCO_RESERVA_MS` = 15 s |
| Ruta conductor → punto de encuentro | Recalculo con `getRoute` | `REFRESCO_APROX_MS` = 30 s |
| Cronómetro del viaje | `setInterval` local, inicio persistido con `tripTimer` | 1 s |
| Chat | Conexión en tiempo real (`conectarChat`, `suscribirseAPersona`) y envío por REST (`enviarMensajeRest`); historial con `historialChat` | — |
| Ubicación del conductor | Hook `useUbicacionViaje` | **[completar]** |
- Ubicación: `expo-location`, permiso en primer plano, precisión `Balanced`. Fallback si no hay permiso: centro de Bogotá (`4.711, -74.0721`).

- Mapa: `PROVIDER_GOOGLE` en Android, `PROVIDER_DEFAULT` en iOS. En **web no se renderiza** (`Platform.OS === 'web'` devuelve `null`).

## 10. Viaje en curso y verificación de abordaje

1\. Conductor: `/my-trips` → `/start-trip?viajeId=` → desliza `SlideToConfirm` → `iniciarViaje(id)` → `guardarInicioViaje` → `/trip-in-progress`.

2\. Pasajero: ve el seguimiento en `/trip-tracking?viajeId=` (también se abre desde push `viaje_iniciado` o desde `/my-reservations`). El código de abordaje se muestra mientras `reserva` esté `CONFIRMADA`, no haya abordado y el viaje esté `PROGRAMADO` o `EN_CURSO`.

3\. Conductor: ingresa el código del pasajero; si coincide con `codigoVerificacion(reserva.id)` llama `marcarAbordo(reservaId, true)`.

4\. Conductor: `completarViaje(id)` → `limpiarInicioViaje` → `/home`. El pasajero recibe alerta al pasar a `COMPLETADO`/`CANCELADO` y luego se le piden calificaciones (`obtenerPendientes` → `CalificarModal`).

Componentes compartidos de seguimiento: `components/tracking/{LiveMap,TopBar,TrackingSheet,hooks,theme}`; utilidades de ruta en `services/geo` (`dividirRuta`, `distancia`, `formatearDistancia`, `formatearEta`, `horaLlegada`).

## 11. Registro de vehículos (detalle)

- Fotos con `expo-image-picker` (cámara o galería), `quality: 0.5`, `base64: true`; se envían como **data URI** (`data:image/jpeg;base64,...`) dentro del body junto a `VehiculoRequest` (`fotoLicencia`, `fotoTarjetaPropiedad`). Si ya existían, llegan como URL.

- Marca/modelo desde `constants/modelosVehiculos` (`modelosPorMarca`), con listas `MARCAS_CARRO` y `MARCAS_MOTO`.

- Tras guardar se llama `enviarTerminosPorCorreo` (copia de términos al correo).

- El vehículo queda en revisión hasta que un administrador lo apruebe; `vehiculo_aprobado` / `vehiculo_rechazado` llegan por push.

- Los requisitos legales (SOAT, tecnomecánica vigentes) no se validan en estas pantallas; si corresponden a otro módulo, **[completar]**.

## 12. Seguridad: puntos a revisar

- **Código de abordaje calculado en el cliente.** Tanto `trip-tracking` (mostrar) como `trip-in-progress` (validar) usan `codigoVerificacion(reserva.id)`. Si la función es determinista a partir del id, cualquiera que conozca el algoritmo puede derivar el código. Conviene generarlo y validarlo en el backend. La implementación está en `services/verificationCode` (no incluida): confírmalo allí.

- **Imágenes de documentos en base64** dentro del JSON: pesan y viajan en cada petición; evaluar subida multipart o almacenamiento con URL firmada.

- Las reglas de §8 deben existir también en el backend (el propio código lo indica para la cancelación).

- Token JWT y credenciales biométricas: verificar el almacenamiento (por ejemplo `expo-secure-store`) en `context/AuthContext` y `services/biometrics`.

- No subir claves de Maps/Places al repositorio.

## 13. Deuda técnica conocida

- `home.tsx` (\~1900 líneas), `vehicle-form.tsx` (\~950), `publish-trip.tsx` (\~900) y `profile.tsx` (\~790) son candidatos a dividirse en componentes y hooks.

- Paletas `DARK_C`/`LIGHT_C` y `DARK_MAP_STYLE` duplicadas en casi todas las pantallas: moverlas a `constants/theme`.

- Coordenadas de la universidad duplicadas en `home.tsx` y `publish-trip.tsx`.

- Estados como strings literales repartidos por varias pantallas.

- Polling en varios puntos donde un canal en tiempo real (ya usado en chat) reduciría tráfico.

- Rutas `(tabs)` y `modal` heredadas de la plantilla de Expo, sin uso funcional.

- No hay pruebas automatizadas en este módulo.

## 14. Convenciones

- Entidades y campos de dominio en español (`Vehiculo`, `viajeId`, `cuposTotales`); términos técnicos en inglés.

- Respuestas y textos al usuario siempre vía i18n; evitar strings fijos en pantallas.

- Formularios nuevos: seguir el patrón de `vehicle-form.tsx` (validación local + botón deshabilitado).

- Errores de red en polling: se silencian y se conserva el último valor (`catch {}` con comentario).

- Cambios que afecten backend y cliente (ej. nuevos campos en `VehiculoRequest`) deben actualizar ambos lados.

## 15. Autores

Fabian Andrey Montaño Piraban · Fredy Alejandro Cipamocha Hernandez

Universidad El Bosque – Programa de Ingeniería de Sistemas.
