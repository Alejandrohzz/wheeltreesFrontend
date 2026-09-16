import { useAppTheme } from '@/contexts/ThemeContext';
import PlaceAutocompleteInput from '@/components/PlaceAutocompleteInput';
import { useAuth } from '@/context/AuthContext';
import { getRoute, LatLng, RouteInfo } from '@/services/directions';
import { getPlaceLatLng, PlaceLatLng } from '@/services/places';
import { calcularPrecioSugerido, formatearPrecioCOP } from '@/services/pricing';
import { obtenerMiPerfil, PerfilResponse } from '@/services/usuarios';
import { Vehiculo } from '@/services/types';
import { listarVehiculos } from '@/services/vehiculos';
import { crearViaje } from '@/services/viajes';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DARK_C = {
  bg:          '#131517',
  surface:     '#1E2126',
  border:      '#2E343C',
  text:        '#FFFFFF',
  textMuted:   '#6B7785',
  textSub:     '#9BA3AD',
  accent:      '#4A90D9',
  accentGreen: '#3DBE7A',
  error:       '#E05C5C',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  surface: '#FFFFFF',
  border: '#DDE1E6',
  text: '#11181C',
  textMuted: '#7A8593',
  textSub: '#5B6472',
  accent: '#4A90D9',
  accentGreen: '#3DBE7A',
  error: '#E05C5C',
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road',         elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'water',        elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'poi',          elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'transit',      elementType: 'geometry', stylers: [{ color: '#2f2f2f' }] },
  { featureType: 'landscape',    elementType: 'geometry', stylers: [{ color: '#1c1c1c' }] },
];

const staticStyles = StyleSheet.create({
  mapPreview: { width: '100%', height: 160 },
});

function RouteMap({ coordinates }: { coordinates: LatLng[] }) {
  const { isDark } = useAppTheme();

  if (Platform.OS === 'web' || coordinates.length === 0) {
    return <View style={[staticStyles.mapPreview, { backgroundColor: isDark ? '#1c1c1c' : '#F5F7F8' }]} />;
  }
  const MapView = require('react-native-maps').default;
  const { Polyline, Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } = require('react-native-maps');
  const mapProvider = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

  const lats = coordinates.map((c) => c.latitude);
  const lngs = coordinates.map((c) => c.longitude);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(0.02, (Math.max(...lats) - Math.min(...lats)) * 1.6),
    longitudeDelta: Math.max(0.02, (Math.max(...lngs) - Math.min(...lngs)) * 1.6),
  };

  return (
    <MapView
      style={staticStyles.mapPreview}
      provider={mapProvider}
      customMapStyle={isDark ? DARK_MAP_STYLE : []}
      region={region}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
    >
      <Polyline coordinates={coordinates} strokeColor={DARK_C.accentGreen} strokeWidth={4} />
      <Marker coordinate={coordinates[0]} pinColor="#3DBE7A" />
      <Marker coordinate={coordinates[coordinates.length - 1]} pinColor="#da6720" />
    </MapView>
  );
}

// Universidad El Bosque: se usa como origen o destino según desde qué
// acceso rápido del home se abra este formulario (ver params recibidos).
const UNIVERSIDAD = {
  descripcion: 'Universidad El Bosque, Avenida Carrera 9, Bogotá, Colombia',
  lat: 4.7103137,
  lng: -74.0322043,
};

const esDestinoUniversidad = (texto: string) =>
  texto.toLowerCase().includes('universidad el bosque');

export default function PublishTripScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { usuario } = useAuth();
  const params = useLocalSearchParams<{
    origenDescripcion?: string;
    origenLat?: string;
    origenLng?: string;
    destinoDescripcion?: string;
    destinoLat?: string;
    destinoLng?: string;
  }>();

  const [vehiculos, setVehiculos]           = useState<Vehiculo[]>([]);
  const [cargandoVehiculos, setCargandoVeh] = useState(true);
  const [vehiculoSel, setVehiculoSel]       = useState<Vehiculo | null>(null);

  const [origenTexto, setOrigenTexto]     = useState(params.origenDescripcion ?? '');
  const [destinoTexto, setDestinoTexto]   = useState(params.destinoDescripcion ?? '');
  const [origenLL, setOrigenLL]           = useState<PlaceLatLng | null>(
    params.origenLat && params.origenLng
      ? { lat: Number(params.origenLat), lng: Number(params.origenLng) }
      : null
  );
  const [destinoLL, setDestinoLL]         = useState<PlaceLatLng | null>(
    esDestinoUniversidad(params.destinoDescripcion ?? '')
      ? { lat: UNIVERSIDAD.lat, lng: UNIVERSIDAD.lng }
      : params.destinoLat && params.destinoLng
        ? { lat: Number(params.destinoLat), lng: Number(params.destinoLng) }
        : null
  );

  const [ruta, setRuta]           = useState<RouteInfo | null>(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [precioSugerido, setPrecioSugerido] = useState<number | null>(null);
  const [perfil, setPerfil] = useState<PerfilResponse | null>(null);

  useEffect(() => {
    obtenerMiPerfil().then(setPerfil).catch(() => {});
  }, []);

  const [fecha, setFecha]                 = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [cuposTotales, setCuposTotales]     = useState('4');
  const [aporte, setAporte]                 = useState('');
  const [esGratis, setEsGratis]             = useState(false);
  const [notas, setNotas]                   = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await listarVehiculos();
        const activos = data.filter((v) => v.activo);
        setVehiculos(activos);
        if (activos.length === 1) setVehiculoSel(activos[0]);
      } catch (e: any) {
        setError('No se pudieron cargar tus vehículos');
      } finally {
        setCargandoVeh(false);
      }
    })();
  }, []);

  const calcularRuta = useCallback(async (o: PlaceLatLng, d: PlaceLatLng) => {
    setCargandoRuta(true);
    setError('');
    try {
      const info = await getRoute(o, d);
      setRuta(info);

      const sugerido = calcularPrecioSugerido({
        distanceMeters: info.distanceMeters,
        durationSeconds: info.durationSeconds,
      });
      setPrecioSugerido(sugerido);

      // Si el usuario todavía no escribió un aporte manualmente y el viaje
      // no está marcado como gratuito, se precarga el sugerido.
      setAporte((actual) => (!esGratis && actual.trim() === '' ? String(sugerido) : actual));
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo calcular la ruta');
      setRuta(null);
      setPrecioSugerido(null);
    } finally {
      setCargandoRuta(false);
    }
  }, [esGratis]);

  useEffect(() => {
    if (origenLL && destinoLL) {
      calcularRuta(origenLL, destinoLL);
    }
  }, [origenLL, destinoLL, calcularRuta]);

  const onChangeFecha = (_: any, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) {
      const nueva = new Date(fecha);
      nueva.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setFecha(nueva);
    }
  };

  const onChangeHora = (_: any, selected?: Date) => {
    setShowTimePicker(false);
    if (selected) {
      const nueva = new Date(fecha);
      nueva.setHours(selected.getHours(), selected.getMinutes());
      setFecha(nueva);
    }
  };

  const validar = () => {
    if (!vehiculoSel) return 'Selecciona el vehículo con el que vas a viajar';
    if (!origenLL)    return 'Selecciona el origen desde las sugerencias';
    if (!destinoLL)   return 'Selecciona el destino desde las sugerencias';
    if (!cuposTotales.trim() || isNaN(Number(cuposTotales)) || Number(cuposTotales) < 1)
      return 'Ingresa un número válido de cupos';
    if (Number(cuposTotales) > vehiculoSel.capacidadPasajeros)
      return `Tu vehículo tiene capacidad para ${vehiculoSel.capacidadPasajeros} pasajeros`;
    if (!esGratis) {
      if (!aporte.trim() || isNaN(Number(aporte)) || Number(aporte) < 0)
        return 'Ingresa un valor válido de aporte por pasajero';
      if (Number(aporte) > 8000)
        return 'El aporte por pasajero no puede superar $8.000';
    }
    if (fecha.getTime() < Date.now())
      return 'La fecha y hora de salida debe ser en el futuro';
    return null;
  };

  const handlePublicar = async () => {
    setError('');
    const err = validar();
    if (err) { setError(err); return; }

    setGuardando(true);
    try {
      await crearViaje({
        vehiculoId: vehiculoSel!.id,
        origenDescripcion: origenTexto,
        destinoDescripcion: destinoTexto,
        origenLat: origenLL?.lat,
        origenLng: origenLL?.lng,
        destinoLat: destinoLL?.lat,
        destinoLng: destinoLL?.lng,
        fechaHoraSalida: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}T${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}:00`,
        cuposTotales: Number(cuposTotales),
        aportePorPasajero: esGratis ? 0 : Number(aporte),
        notas: notas.trim(),
      });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo publicar el viaje');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Publicar viaje</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── VEHÍCULO ─────────────────────────────────────────────── */}
          <Text style={s.label}>Vehículo</Text>
          {cargandoVehiculos ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 12 }} />
          ) : vehiculos.length === 0 ? (
            <View style={s.warnBox}>
              <Text style={s.warnText}>No tienes vehículos activos registrados.</Text>
              <TouchableOpacity onPress={() => router.push('/vehicles')}>
                <Text style={s.warnLink}>Registrar un vehículo →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.vehicleRow}>
              {vehiculos.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[s.vehicleChip, vehiculoSel?.id === v.id && s.vehicleChipActive]}
                  onPress={() => setVehiculoSel(v)}
                  activeOpacity={0.75}
                >
                  <Text style={s.vehicleIcon}>{v.tipo === 'MOTO' ? '🏍️' : '🚗'}</Text>
                  <View>
                    <Text style={[s.vehiclePlate, vehiculoSel?.id === v.id && s.vehicleTextActive]}>{v.placa}</Text>
                    <Text style={s.vehicleModel}>{v.marca} {v.modelo}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── ORIGEN / DESTINO ─────────────────────────────────────── */}
          <View style={{ marginTop: 20, gap: 8 }}>
            <View>
              <View style={s.placeBorderGreen}>
                <PlaceAutocompleteInput
                  label="Origen"
                  icon="🟢"
                  placeholder="¿Desde dónde sales?"
                  value={origenTexto}
                  onChangeText={(t) => { setOrigenTexto(t); setOrigenLL(null); setRuta(null); }}
                  onSelectPlace={async (p) => {
                    setOrigenTexto(p.description);
                    const ll = await getPlaceLatLng(p.placeId);
                    setOrigenLL(ll);
                  }}
                />
                <View pointerEvents="none" style={s.placeBorderOverlay} />
              </View>
              {(!!perfil?.direccionCasa || !!perfil?.direccionTrabajo) && (
                <View style={s.quickChipsRow}>
                  {!!perfil?.direccionCasa && (
                    <TouchableOpacity
                      style={s.quickChip}
                      activeOpacity={0.7}
                      onPress={() => {
                        setOrigenTexto(perfil.direccionCasa!);
                        setOrigenLL({ lat: perfil.casaLat!, lng: perfil.casaLng! });
                        setRuta(null);
                      }}
                    >
                      <Text style={s.quickChipText}>Mi casa</Text>
                    </TouchableOpacity>
                  )}
                  {!!perfil?.direccionTrabajo && (
                    <TouchableOpacity
                      style={s.quickChip}
                      activeOpacity={0.7}
                      onPress={() => {
                        setOrigenTexto(perfil.direccionTrabajo!);
                        setOrigenLL({ lat: perfil.trabajoLat!, lng: perfil.trabajoLng! });
                        setRuta(null);
                      }}
                    >
                      <Text style={s.quickChipText}>Mi trabajo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            

            <View>
              {esDestinoUniversidad(destinoTexto) ? (
                <View style={s.lockedPlace}>
                  <Text style={s.lockedPlaceIcon}>🟠</Text>
                  <View style={s.lockedPlaceContent}>
                    <Text style={s.lockedPlaceText} numberOfLines={1}>{destinoTexto}</Text>
                  </View>
                </View>
              ) : (
                <PlaceAutocompleteInput
                  label="Destino"
                  icon="🟠"
                  placeholder="¿Hacia dónde vas?"
                  value={destinoTexto}
                  onChangeText={(t) => { setDestinoTexto(t); setDestinoLL(null); setRuta(null); }}
                  onSelectPlace={async (p) => {
                    setDestinoTexto(p.description);
                    if (esDestinoUniversidad(p.description)) {
                      setDestinoLL({ lat: UNIVERSIDAD.lat, lng: UNIVERSIDAD.lng });
                    } else {
                      const ll = await getPlaceLatLng(p.placeId);
                      setDestinoLL(ll);
                    }
                  }}
                />
              )}
              {(!!perfil?.direccionCasa || !!perfil?.direccionTrabajo) && (
                <View style={s.quickChipsRow}>
                  {!!perfil?.direccionCasa && (
                    <TouchableOpacity
                      style={s.quickChip}
                      activeOpacity={0.7}
                      onPress={() => {
                        setDestinoTexto(perfil.direccionCasa!);
                        setDestinoLL({ lat: perfil.casaLat!, lng: perfil.casaLng! });
                        setRuta(null);
                      }}
                    >
                      <Text style={s.quickChipText}>Mi casa</Text>
                    </TouchableOpacity>
                  )}
                  {!!perfil?.direccionTrabajo && (
                    <TouchableOpacity
                      style={s.quickChip}
                      activeOpacity={0.7}
                      onPress={() => {
                        setDestinoTexto(perfil.direccionTrabajo!);
                        setDestinoLL({ lat: perfil.trabajoLat!, lng: perfil.trabajoLng! });
                        setRuta(null);
                      }}
                    >
                      <Text style={s.quickChipText}>Mi trabajo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* ── VISTA PREVIA DE RUTA ─────────────────────────────────── */}
          {cargandoRuta && (
            <View style={s.routeLoading}>
              <ActivityIndicator color={C.accent} />
              <Text style={s.routeLoadingText}>Calculando ruta...</Text>
            </View>
          )}

          {ruta && !cargandoRuta && (
            <View style={s.routeCard}>
              <RouteMap coordinates={ruta.coordinates} />
              <View style={s.routeInfoRow}>
                <Text style={s.routeInfoText}>{ruta.distanceText}</Text>
                <Text style={s.routeInfoText}>{ruta.durationText}</Text>
              </View>
            </View>
          )}

          {/* ── FECHA / HORA ─────────────────────────────────────────── */}
          <Text style={[s.label, { marginTop: 20 }]}>Fecha y hora de salida</Text>
          <View style={s.dateColumn}>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.75}>
              <Text style={s.dateCaption}>Fecha</Text>
              <Text style={s.dateBtnText}>
                {fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowTimePicker(true)} activeOpacity={0.75}>
              <Text style={s.dateCaption}>Hora de salida</Text>
              <Text style={s.dateBtnText}>
                {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>
          <Modal
            visible={showDatePicker || showTimePicker}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
          >
            <View style={s.pickerOverlay}>
              <View style={s.pickerCard}>
                <Text style={s.pickerTitle}>
                  {showDatePicker ? 'Selecciona la fecha' : 'Selecciona la hora'}
                </Text>
                <DateTimePicker
                  value={fecha}
                  mode={showDatePicker ? 'date' : 'time'}
                  minimumDate={showDatePicker ? new Date() : undefined}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={showDatePicker ? onChangeFecha : onChangeHora}
                  themeVariant="dark"
                  textColor={C.text}
                />
                <TouchableOpacity
                  style={s.pickerCloseBtn}
                  onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={s.pickerCloseText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* ── CUPOS / APORTE ───────────────────────────────────────── */}
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Cupos disponibles</Text>
              <TextInput
                style={s.input}
                value={cuposTotales}
                onChangeText={setCuposTotales}
                keyboardType="number-pad"
                placeholder="4"
                placeholderTextColor={C.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.aporteLabelRow}>
                <Text style={[s.label, s.aporteLabel]}>Aporte por pasajero</Text>
                <View style={s.gratisRow}>
                  <Text style={s.gratisLabel}>Gratis</Text>
                  <Switch
                    value={esGratis}
                    onValueChange={(valor) => {
                      setEsGratis(valor);
                      if (valor) {
                        setAporte('0');
                      } else if (precioSugerido !== null) {
                        setAporte(String(precioSugerido));
                      } else {
                        setAporte('');
                      }
                    }}
                    trackColor={{ false: C.border, true: C.accentGreen }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
              <TextInput
                style={[s.input, esGratis && s.inputDisabled]}
                value={esGratis ? 'Gratis' : aporte}
                onChangeText={setAporte}
                keyboardType="number-pad"
                placeholder="$ 8.000"
                placeholderTextColor={C.textMuted}
                editable={!esGratis}
              />
              {!esGratis && precioSugerido !== null && (
                <TouchableOpacity
                  style={s.sugeridoChip}
                  onPress={() => setAporte(String(precioSugerido))}
                  activeOpacity={0.7}
                >
                  <Text style={s.sugeridoText}>
                    💡 Sugerido: {formatearPrecioCOP(precioSugerido)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── NOTAS ────────────────────────────────────────────────── */}
          <Text style={[s.label, { marginTop: 16 }]}>Notas (opcional)</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={notas}
            onChangeText={setNotas}
            placeholder="Ej: salgo puntual, punto de encuentro en la portería..."
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={3}
          />

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[s.publishBtn, guardando && { opacity: 0.6 }]}
            onPress={handlePublicar}
            disabled={guardando}
            activeOpacity={0.85}
          >
            {guardando
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={s.publishText}>Publicar viaje</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: C.text },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },

  scroll: { padding: 20, paddingBottom: 48 },

  label: { fontSize: 13, fontWeight: '600', color: C.textMuted, marginBottom: 8 },

  warnBox: {
    backgroundColor: 'rgba(224,92,92,0.1)',
    borderWidth: 1,
    borderColor: C.error,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  warnText: { color: C.text, fontSize: 13 },
  warnLink: { color: C.accent, fontWeight: '700', fontSize: 13 },

  vehicleRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.surface,
  },
  vehicleChipActive: { borderColor: C.accent, backgroundColor: 'rgba(74,144,217,0.12)' },
  vehicleIcon: { fontSize: 18 },
  vehiclePlate: { color: C.text, fontWeight: '700', fontSize: 14 },
  vehicleTextActive: { color: C.accent },
  vehicleModel: { color: C.textMuted, fontSize: 11, marginTop: 1 },

  routeLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  routeLoadingText: { color: C.textSub, fontSize: 13 },

  routeCard: {
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  mapPreview: { width: '100%', height: 160 },
  routeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: C.surface,
    paddingVertical: 10,
  },
  routeInfoText: { color: C.accentGreen, fontWeight: '700', fontSize: 13 },

  dateColumn: {
    width: '100%',
    flexDirection: 'column',
    gap: 10,
  },
  dateBtn: {
    width: '100%',
    flex: 0,
    minHeight: 58,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCaption: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  dateBtnText: { color: C.text, fontWeight: '600', fontSize: 14 },

  placeBorderGreen: {
    position: 'relative',
  },
  placeBorderOverlay: {
    position: 'absolute',
    top: 28,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: C.accentGreen,
    borderRadius: 12,
  },

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    alignItems: 'center',
  },
  pickerTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  pickerCloseBtn: {
    width: '100%',
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  pickerCloseText: {
    color: C.textSub,
    fontWeight: '700',
    fontSize: 14,
  },

  twoCol: { flexDirection: 'row', gap: 12, marginTop: 16 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  aporteLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 28,
  },
  aporteLabel: {
    flex: 1,
    marginBottom: 0,
    paddingRight: 6,
    flexShrink: 1,
  },
  gratisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: 2,
    borderRadius: 16,
  },
  gratisLabel: { fontSize: 12, fontWeight: '700', color: C.textSub },
  inputDisabled: { opacity: 0.5 },

  sugeridoChip: { marginTop: 8, alignSelf: 'flex-start' },

  lockedPlace: {
    height: 58,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(218,103,32,0.5)',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  lockedPlaceIcon: { fontSize: 18, marginRight: 10 },
  lockedPlaceContent: { flex: 1 },
  lockedPlaceText: { color: C.text, fontSize: 15, fontWeight: '600' },
  lockedPlaceHint: { color: C.textMuted, fontSize: 10, marginTop: 2 },
  lockedPlaceLock: { fontSize: 14, marginLeft: 8 },

  quickChipsRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  quickChip: {
    backgroundColor: 'rgba(74, 144, 217, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 217, 0.35)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickChipText: { fontSize: 12, fontWeight: '600', color: C.accent },

  swapBtn: {
    alignSelf: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -4,
    zIndex: 5,
  },
  swapBtnIcon: { fontSize: 16, color: C.textSub, fontWeight: '700' },
  sugeridoText: { color: C.accentGreen, fontSize: 12, fontWeight: '600' },

  errorText: { color: C.error, fontSize: 13, marginTop: 16, textAlign: 'center' },

  publishBtn: {
    backgroundColor: C.accentGreen,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  publishText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
}
