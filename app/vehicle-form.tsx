import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { modelosPorMarca } from '@/constants/modelosVehiculos';
import { TipoVehiculo } from '@/services/types';
import { enviarTerminosPorCorreo } from '@/services/terminos';
import { actualizarVehiculo, crearVehiculo, listarVehiculos, VehiculoRequest } from '@/services/vehiculos';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DARK_C = {
  bg:          '#131517',
  surface:     '#1E2126',
  border:      '#2E343C',
  borderFocus: '#4A90D9',
  text:        '#FFFFFF',
  textMuted:   '#6B7785',
  accent:      '#4A90D9',
  accentGreen: '#3DBE7A',
  error:       '#E05C5C',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  surface: '#FFFFFF',
  border: '#DDE1E6',
  borderFocus: '#4A90D9',
  text: '#11181C',
  textMuted: '#7A8593',
  accent: '#4A90D9',
  accentGreen: '#3DBE7A',
  error: '#E05C5C',
};

const CAPACIDAD_POR_TIPO: Record<TipoVehiculo, string> = {
  MOTO: '1',
  CARRO: '4',
};

const CAPACIDAD_MIN_CARRO = 2;
const CAPACIDAD_MAX_CARRO = 7;

const TIPOS_VALUES: { value: TipoVehiculo }[] = [
  { value: 'MOTO' },
  { value: 'CARRO' },
];

// ───────────────────────── Placas ─────────────────────────
// Carro: 3 letras + 3 números (ABC123)
// Moto:  3 letras + 2 números + 1 letra (ABC12D)
const PLACA_REGEX: Record<TipoVehiculo, RegExp> = {
  CARRO: /^[A-Z]{3}[0-9]{3}$/,
  MOTO:  /^[A-Z]{3}[0-9]{2}[A-Z]$/,
};

const PLACA_PLACEHOLDER: Record<TipoVehiculo, string> = {
  CARRO: 'ABC123',
  MOTO:  'ABC12D',
};

// Qué tipo de carácter se acepta en cada posición ('L' = letra, 'N' = número)
const PLACA_PATRON: Record<TipoVehiculo, ('L' | 'N')[]> = {
  CARRO: ['L', 'L', 'L', 'N', 'N', 'N'],
  MOTO:  ['L', 'L', 'L', 'N', 'N', 'L'],
};

// Filtra lo que escribe el usuario para que solo entre lo que corresponde
// a cada posición de la placa. Ej: en carro, una letra en la posición 4 se ignora.
function formatearPlaca(raw: string, tipo: TipoVehiculo): string {
  const patron = PLACA_PATRON[tipo];
  const limpio = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let out = '';
  for (const ch of limpio) {
    if (out.length >= patron.length) break;
    const esperado = patron[out.length];
    const esLetra = /[A-Z]/.test(ch);
    if ((esperado === 'L' && esLetra) || (esperado === 'N' && !esLetra)) out += ch;
  }
  return out;
}

// ───────────────────────── Marcas ─────────────────────────
// Los modelos de cada marca viven en '@/constants/modelosVehiculos'.
// El nombre de la marca debe coincidir exactamente con la llave allá.
const MARCAS_CARRO = [
  'Audi', 'BMW', 'BYD', 'Changan', 'Chery', 'Chevrolet', 'Citroën', 'Dodge',
  'DFSK', 'Fiat', 'Ford', 'Great Wall', 'Honda', 'Hyundai', 'JAC', 'Jeep',
  'Kia', 'KGM (SsangYong)', 'Land Rover', 'Mazda', 'Mercedes-Benz', 'MG',
  'Mini', 'Mitsubishi', 'Nissan', 'Peugeot', 'Renault', 'Seat', 'Skoda',
  'Subaru', 'Suzuki', 'Toyota', 'Volkswagen', 'Volvo', 'Otra',
];

const MARCAS_MOTO = [
  'AKT', 'Bajaj', 'Benelli', 'BMW', 'Ducati', 'Hero', 'Honda', 'Kawasaki',
  'KTM', 'Kymco', 'Piaggio', 'Royal Enfield', 'Suzuki', 'Triumph', 'TVS',
  'Vespa', 'Victory', 'Yamaha', 'Zontes', 'Otra',
];

// ───────────────────────── Colores ─────────────────────────
// Colores aceptados para el registro vehicular en Colombia (RUNT)
const COLORES: { nombre: string; hex: string }[] = [
  { nombre: 'Amarillo',  hex: '#F2C500' },
  { nombre: 'Azul',      hex: '#1F5FBF' },
  { nombre: 'Beige',     hex: '#D8C8A8' },
  { nombre: 'Blanco',    hex: '#FFFFFF' },
  { nombre: 'Bronce',    hex: '#A8743A' },
  { nombre: 'Dorado',    hex: '#C9A227' },
  { nombre: 'Gris',      hex: '#8A8F98' },
  { nombre: 'Marrón',    hex: '#6B4226' },
  { nombre: 'Naranja',   hex: '#F28C28' },
  { nombre: 'Negro',     hex: '#111111' },
  { nombre: 'Plateado',  hex: '#C0C4CC' },
  { nombre: 'Rojo',      hex: '#D32F2F' },
  { nombre: 'Verde',     hex: '#2E7D32' },
  { nombre: 'Vinotinto', hex: '#6D1A2B' },
];
const COLORES_NOMBRES = COLORES.map((c) => c.nombre);
const COLOR_HEX: Record<string, string> = Object.fromEntries(COLORES.map((c) => [c.nombre, c.hex]));

// ───────────────────────── Años ─────────────────────────
// En Colombia no hay una edad máxima legal para vehículos particulares;
// este límite es una regla de la app: solo vehículos de los últimos 20 años.
// Se calcula solo y se mueve cada año.
const ANIO_MAX = new Date().getFullYear() + 1; // los modelos del año siguiente ya se venden
const ANIO_MIN = new Date().getFullYear() - 19; // año actual + los 19 anteriores = 20 años
const ANIOS: string[] = Array.from({ length: ANIO_MAX - ANIO_MIN + 1 }, (_, i) => String(ANIO_MAX - i));

// Definido FUERA del componente de pantalla: si se define adentro, React lo
// recrea como un tipo de componente nuevo en cada render y el TextInput
// pierde el foco (se cierra el teclado) con cada letra que se escribe.
function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  editable?: boolean;
  hint?: string;
  maxLength?: number;
  colors: typeof DARK_C;
  styles: ReturnType<typeof createStyles>;
}) {
  const editable = props.editable ?? true;
  return (
    <View style={props.styles.fieldWrap}>
      <Text style={props.styles.label}>{props.label}</Text>
      <TextInput
        style={[props.styles.input, !editable && props.styles.inputDisabled]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={props.colors.textMuted}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        maxLength={props.maxLength}
        editable={editable}
      />
      {!!props.hint && <Text style={props.styles.fieldHint}>{props.hint}</Text>}
    </View>
  );
}

// Selector tipo "dropdown" con modal. También fuera del componente de pantalla.
function SelectField(props: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onSelect: (v: string) => void;
  swatches?: Record<string, string>;
  disabled?: boolean;
  colors: typeof DARK_C;
  styles: ReturnType<typeof createStyles>;
}) {
  const [open, setOpen] = useState(false);
  const { styles: s, colors: C } = props;

  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{props.label}</Text>
      <TouchableOpacity
        style={[s.select, props.disabled && s.inputDisabled]}
        onPress={() => !props.disabled && setOpen(true)}
        disabled={props.disabled}
        activeOpacity={0.7}
      >
        <View style={s.selectLeft}>
          {!!props.value && props.swatches?.[props.value] && (
            <View style={[s.swatch, { backgroundColor: props.swatches[props.value] }]} />
          )}
          <Text style={props.value ? s.selectText : s.selectPlaceholder}>
            {props.value || props.placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={C.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>{props.label}</Text>
            <FlatList
              data={props.options}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const activo = item === props.value;
                return (
                  <TouchableOpacity
                    style={s.optionRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      props.onSelect(item);
                      setOpen(false);
                    }}
                  >
                    <View style={s.selectLeft}>
                      {props.swatches?.[item] && (
                        <View style={[s.swatch, { backgroundColor: props.swatches[item] }]} />
                      )}
                      <Text style={[s.optionText, activo && s.optionTextActive]}>{item}</Text>
                    </View>
                    {activo && <Ionicons name="checkmark" size={18} color={C.accentGreen} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Cuadro para subir una foto (cámara o galería). Fuera del componente de pantalla.
const IMAGE_OPTS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.5,   // comprime para que el envío no sea pesado
  base64: true,
};

async function elegirImagen(origen: 'camara' | 'galeria'): Promise<string | null | 'denegado'> {
  const permiso = origen === 'camara'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) return 'denegado';

  const res = origen === 'camara'
    ? await ImagePicker.launchCameraAsync(IMAGE_OPTS)
    : await ImagePicker.launchImageLibraryAsync(IMAGE_OPTS);
  if (res.canceled || !res.assets?.length) return null;

  const a = res.assets[0];
  return a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri;
}

function PhotoBox(props: {
  label: string;
  hint: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  uri: string;
  onChange: (uri: string) => void;
  colors: typeof DARK_C;
  styles: ReturnType<typeof createStyles>;
}) {
  const { t } = useTranslation();
  const { styles: s, colors: C } = props;

  const elegir = async (origen: 'camara' | 'galeria') => {
    const r = await elegirImagen(origen);
    if (r === 'denegado') {
      Alert.alert(
        t('vehicleForm.permisoTitle', { defaultValue: 'Permiso necesario' }),
        origen === 'camara'
          ? t('vehicleForm.permisoCamara', { defaultValue: 'Activa el permiso de cámara en los ajustes del teléfono.' })
          : t('vehicleForm.permisoGaleria', { defaultValue: 'Activa el permiso de fotos en los ajustes del teléfono.' }),
      );
      return;
    }
    if (r) props.onChange(r);
  };

  const abrirOpciones = () => {
    Alert.alert(props.label, undefined, [
      { text: t('vehicleForm.tomarFoto', { defaultValue: 'Tomar foto' }), onPress: () => elegir('camara') },
      { text: t('vehicleForm.elegirGaleria', { defaultValue: 'Elegir de la galería' }), onPress: () => elegir('galeria') },
      { text: t('common.cancel', { defaultValue: 'Cancelar' }), style: 'cancel' },
    ]);
  };

  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{props.label}</Text>
      <TouchableOpacity style={[s.photoBox, !!props.uri && s.photoBoxFilled]} onPress={abrirOpciones} activeOpacity={0.7}>
        {props.uri ? (
          <>
            <Image source={{ uri: props.uri }} style={s.photoImg} resizeMode="cover" />
            <TouchableOpacity style={s.photoRemove} onPress={() => props.onChange('')} activeOpacity={0.8}>
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={s.photoEmpty}>
            <View style={s.photoIconWrap}>
              <Ionicons name={props.icon} size={24} color={C.accentGreen} />
            </View>
            <Text style={s.photoCta}>{t('vehicleForm.subirFoto', { defaultValue: 'Subir foto' })}</Text>
            <Text style={s.photoHint}>{props.hint}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function VehicleFormScreen() {
  const { t, i18n } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { usuario } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const esEdicion = !!id;

  const [tipo, setTipo]           = useState<TipoVehiculo>('MOTO');
  const [placa, setPlaca]         = useState('');
  const [marca, setMarca]         = useState('');
  const [modelo, setModelo]       = useState('');
  const [anio, setAnio]           = useState('');
  const [color, setColor]         = useState('');
  const [capacidad, setCapacidad] = useState(CAPACIDAD_POR_TIPO.MOTO);
  const [cedula, setCedula]       = useState('');
  // Fotos de documentos, guardadas como data URI (base64) o URL si ya existían
  const [fotoLicencia, setFotoLicencia] = useState('');
  const [fotoTarjeta, setFotoTarjeta]   = useState('');
  const [terminosAceptados, setTerminosAceptados] = useState(false);
  const [docsAutorizados, setDocsAutorizados] = useState(false);

  const [cargandoDatos, setCargandoDatos] = useState(esEdicion);
  const [guardando, setGuardando]         = useState(false);
  const [error, setError]                 = useState('');

  const marcasDisponibles = tipo === 'MOTO' ? MARCAS_MOTO : MARCAS_CARRO;
  // Modelos de la marca elegida. Vacío si no hay marca o si es "Otra".
  const modelosDisponibles = useMemo(() => modelosPorMarca(tipo, marca), [tipo, marca]);

  // Si estamos editando, buscamos el vehículo entre la lista para precargar el formulario
  useEffect(() => {
    if (!esEdicion) return;
    (async () => {
      try {
        const lista = await listarVehiculos();
        const v = lista.find((x) => x.id === id);
        if (v) {
          setTipo(v.tipo);
          setPlaca(v.placa);
          setMarca(v.marca);
          setModelo(v.modelo);
          setAnio(String(v.anio));
          setColor(v.color);
          setCapacidad(String(v.capacidadPasajeros));
          setCedula(v.cedulaPropietario);
          setFotoLicencia((v as any).fotoLicencia ?? '');
          setFotoTarjeta((v as any).fotoTarjetaPropiedad ?? '');
          setTerminosAceptados(!!v.terminosAceptados);
          setDocsAutorizados(!!v.terminosAceptados); // ya los autorizó al registrarlo
        }
      } catch (e: any) {
        setError(e?.message ?? t('vehicleForm.errorLoad'));
      } finally {
        setCargandoDatos(false);
      }
    })();
  }, [esEdicion, id]);

  const cambiarTipo = (nuevo: TipoVehiculo) => {
    setTipo(nuevo);
    setCapacidad(CAPACIDAD_POR_TIPO[nuevo]);
    // La placa se re-filtra con el patrón del nuevo tipo
    setPlaca((prev) => formatearPlaca(prev, nuevo));
    // Si la marca elegida no existe en la lista del nuevo tipo, se limpia
    // (junto con el modelo, que depende de la marca)
    const lista = nuevo === 'MOTO' ? MARCAS_MOTO : MARCAS_CARRO;
    if (!lista.includes(marca)) {
      setMarca('');
      setModelo('');
    } else if (!modelosPorMarca(nuevo, marca).includes(modelo)) {
      setModelo('');
    }
  };

  // Al cambiar de marca, el modelo anterior ya no aplica
  const cambiarMarca = (nueva: string) => {
    if (nueva !== marca) setModelo('');
    setMarca(nueva);
  };

  const ajustarCapacidad = (delta: number) => {
    setCapacidad((prev) => {
      const next = (Number(prev) || CAPACIDAD_MIN_CARRO) + delta;
      const clamped = Math.min(CAPACIDAD_MAX_CARRO, Math.max(CAPACIDAD_MIN_CARRO, next));
      return String(clamped);
    });
  };

  const validar = () => {
    if (!placa.trim()) return t('vehicleForm.errorPlaca');
    if (!PLACA_REGEX[tipo].test(placa.trim().toUpperCase())) {
      return t('vehicleForm.errorPlacaFormato', {
        defaultValue:
          tipo === 'CARRO'
            ? 'La placa del carro debe tener 3 letras y 3 números (ej. ABC123)'
            : 'La placa de la moto debe tener 3 letras, 2 números y 1 letra (ej. ABC12D)',
      });
    }
    if (!marca.trim()) return t('vehicleForm.errorMarca');
    if (!modelo.trim()) return t('vehicleForm.errorModelo');
    if (!ANIOS.includes(anio)) return t('vehicleForm.errorAnio');
    if (!color.trim()) return t('vehicleForm.errorColor');
    if (!capacidad.trim() || isNaN(Number(capacidad))) return t('vehicleForm.errorCapacidad');
    if (
      tipo === 'CARRO' &&
      (Number(capacidad) < CAPACIDAD_MIN_CARRO || Number(capacidad) > CAPACIDAD_MAX_CARRO)
    ) return t('vehicleForm.errorCapacidad');
    if (!/^[0-9]{6,10}$/.test(cedula.trim())) return t('vehicleForm.errorCedula');
    if (!esEdicion && !fotoLicencia) {
      return t('vehicleForm.errorLicencia', { defaultValue: 'Sube la foto de tu licencia de conducción' });
    }
    if (!esEdicion && !fotoTarjeta) {
      return t('vehicleForm.errorTarjeta', { defaultValue: 'Sube la foto de la tarjeta de propiedad' });
    }
    if (!terminosAceptados) return t('vehicleForm.errorTerminos');
    if (!docsAutorizados) return t('vehicleForm.errorDocs');
    return null;
  };

  const handleGuardar = async () => {
    setError('');
    const err = validar();
    if (err) { setError(err); return; }

    // fotoLicencia y fotoTarjetaPropiedad son campos nuevos: agrégalos a
    // VehiculoRequest (services/vehiculos) y al DTO del backend.
    const body: VehiculoRequest & { fotoLicencia?: string; fotoTarjetaPropiedad?: string } = {
      tipo,
      placa: placa.trim().toUpperCase(),
      marca: marca.trim(),
      modelo: modelo.trim(),
      anio: Number(anio),
      color: color.trim(),
      capacidadPasajeros: Number(capacidad),
      cedulaPropietario: cedula.trim(),
      ...(fotoLicencia ? { fotoLicencia } : {}),
      ...(fotoTarjeta ? { fotoTarjetaPropiedad: fotoTarjeta } : {}),
      terminosAceptados,
    };

    setGuardando(true);
    try {
      if (esEdicion && id) {
        await actualizarVehiculo(id, body);
      } else {
        // El backend lo crea en estado PENDIENTE; el admin lo revisa desde su panel.
        await crearVehiculo(body);
        // Copia de los términos aceptados al correo del usuario. Si el envío
        // falla no se bloquea el registro del vehículo.
        enviarTerminosPorCorreo(i18n.language)
          .then(() =>
            Alert.alert(
              t('vehicleForm.copiaEnviadaTitulo'),
              t('vehicleForm.copiaEnviada', { email: usuario?.email ?? '' }),
            ))
          .catch(() => {});
      }
      router.back();
    } catch (e: any) {
      setError(e?.message ?? t('vehicleForm.errorSave'));
    } finally {
      setGuardando(false);
    }
  };

  if (cargandoDatos) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centerBox}>
          <ActivityIndicator color={C.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{esEdicion ? t('vehicleForm.titleEdit') : t('vehicleForm.titleNew')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>{t('vehicleForm.tipoVehiculo')}</Text>
          <View style={s.typeRow}>
            {TIPOS_VALUES.map((tv) => (
              <TouchableOpacity
                key={tv.value}
                style={[s.typeChip, tipo === tv.value && s.typeChipActive]}
                onPress={() => cambiarTipo(tv.value)}
                activeOpacity={0.7}
              >
                {tv.value === 'MOTO'
                  ? <MaterialCommunityIcons name="motorbike" size={18} color={tipo === tv.value ? C.accentGreen : C.textMuted} />
                  : <Ionicons name="car-outline" size={18} color={tipo === tv.value ? C.accentGreen : C.textMuted} />}
                <Text style={[s.typeLabel, tipo === tv.value && s.typeLabelActive]}>
                  {tv.value === 'MOTO' ? t('vehicleForm.tipoMoto') : t('vehicleForm.tipoCarro')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field
            colors={C}
            styles={s}
            label={t('vehicleForm.placaLabel')}
            value={placa}
            onChangeText={(v) => setPlaca(formatearPlaca(v, tipo))}
            autoCapitalize="characters"
            maxLength={6}
            placeholder={PLACA_PLACEHOLDER[tipo]}
            hint={
              tipo === 'CARRO'
                ? t('vehicleForm.placaHintCarro', { defaultValue: '3 letras y 3 números (ej. ABC123)' })
                : t('vehicleForm.placaHintMoto', { defaultValue: '3 letras, 2 números y 1 letra (ej. ABC12D)' })
            }
          />

          <SelectField
            colors={C}
            styles={s}
            label={t('vehicleForm.marcaLabel')}
            value={marca}
            options={marcasDisponibles}
            placeholder={t('vehicleForm.marcaSelect', { defaultValue: 'Selecciona la marca' })}
            onSelect={cambiarMarca}
          />

          {modelosDisponibles.length > 0 ? (
            // Marca con catálogo: el usuario elige el modelo de la lista
            <SelectField
              colors={C}
              styles={s}
              label={t('vehicleForm.modeloLabel')}
              value={modelo}
              options={modelosDisponibles}
              placeholder={t('vehicleForm.modeloSelect', { defaultValue: 'Selecciona el modelo' })}
              onSelect={setModelo}
            />
          ) : marca ? (
            // Marca "Otra" (sin catálogo): el usuario escribe el modelo
            <Field
              colors={C}
              styles={s}
              label={t('vehicleForm.modeloLabel')}
              value={modelo}
              onChangeText={setModelo}
              placeholder={tipo === 'MOTO' ? 'Faz' : 'Spark GT'}
            />
          ) : (
            // Aún no hay marca: selector bloqueado
            <SelectField
              colors={C}
              styles={s}
              label={t('vehicleForm.modeloLabel')}
              value=""
              options={[]}
              placeholder={t('vehicleForm.modeloPrimeroMarca', { defaultValue: 'Primero selecciona la marca' })}
              onSelect={() => {}}
              disabled
            />
          )}

          <SelectField
            colors={C}
            styles={s}
            label={t('vehicleForm.anioLabel')}
            value={anio}
            options={ANIOS}
            placeholder={t('vehicleForm.anioSelect', { defaultValue: 'Selecciona el año' })}
            onSelect={setAnio}
          />

          <SelectField
            colors={C}
            styles={s}
            label={t('vehicleForm.colorLabel')}
            value={color}
            options={COLORES_NOMBRES}
            swatches={COLOR_HEX}
            placeholder={t('vehicleForm.colorSelect', { defaultValue: 'Selecciona el color' })}
            onSelect={setColor}
          />

          {tipo === 'CARRO' ? (
            <View style={s.fieldWrap}>
              <Text style={s.label}>{t('vehicleForm.capacidadLabel')}</Text>
              <View style={s.stepperRow}>
                <TouchableOpacity
                  style={[s.stepperBtn, Number(capacidad) <= CAPACIDAD_MIN_CARRO && s.stepperBtnDisabled]}
                  onPress={() => ajustarCapacidad(-1)}
                  disabled={Number(capacidad) <= CAPACIDAD_MIN_CARRO}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={18} color={Number(capacidad) <= CAPACIDAD_MIN_CARRO ? C.textMuted : C.text} />
                </TouchableOpacity>
                <Text style={s.stepperValue}>{capacidad}</Text>
                <TouchableOpacity
                  style={[s.stepperBtn, Number(capacidad) >= CAPACIDAD_MAX_CARRO && s.stepperBtnDisabled]}
                  onPress={() => ajustarCapacidad(1)}
                  disabled={Number(capacidad) >= CAPACIDAD_MAX_CARRO}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color={Number(capacidad) >= CAPACIDAD_MAX_CARRO ? C.textMuted : C.text} />
                </TouchableOpacity>
              </View>
              <Text style={s.fieldHint}>{t('vehicleForm.capacidadHintCarro')}</Text>
            </View>
          ) : (
            <Field
              colors={C}
              styles={s}
              label={t('vehicleForm.capacidadLabel')}
              value={capacidad}
              onChangeText={setCapacidad}
              keyboardType="number-pad"
              editable={false}
              hint={t('vehicleForm.capacidadHintMoto')}
            />
          )}

          <Field
            colors={C}
            styles={s}
            label={t('vehicleForm.cedulaLabel')}
            value={cedula}
            onChangeText={(v) => setCedula(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="1012345678"
          />
          <PhotoBox
            colors={C}
            styles={s}
            label={t('vehicleForm.licenciaLabel', { defaultValue: 'Licencia de conducción' })}
            hint={t('vehicleForm.licenciaHint', { defaultValue: 'Foto clara de la licencia, por el lado frontal' })}
            icon="card-outline"
            uri={fotoLicencia}
            onChange={setFotoLicencia}
          />
          <PhotoBox
            colors={C}
            styles={s}
            label={t('vehicleForm.tarjetaLabel', { defaultValue: 'Tarjeta de propiedad' })}
            hint={t('vehicleForm.tarjetaHint', { defaultValue: 'Foto clara de la tarjeta de propiedad del vehículo' })}
            icon="document-text-outline"
            uri={fotoTarjeta}
            onChange={setFotoTarjeta}
          />

          <TouchableOpacity
            style={s.termsRow}
            onPress={() => setTerminosAceptados((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, terminosAceptados && s.checkboxChecked]}>
              {terminosAceptados && <Text style={s.checkboxMark}>✓</Text>}
            </View>
            <Text style={s.termsText}>
              {t('vehicleForm.termsText')}
              <Text style={s.termsLink} onPress={() => router.push('/terms')}>
                {t('vehicleForm.termsLink')}
              </Text>
              {t('vehicleForm.termsSuffix')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.termsRow}
            onPress={() => setDocsAutorizados((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, docsAutorizados && s.checkboxChecked]}>
              {docsAutorizados && <Text style={s.checkboxMark}>✓</Text>}
            </View>
            <Text style={s.termsText}>
              {t('vehicleForm.docsText')}
              <Text style={s.termsLink} onPress={() => router.push('/terms')}>
                {t('vehicleForm.docsLink')}
              </Text>
            </Text>
          </TouchableOpacity>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[s.saveBtn, (guardando || !terminosAceptados || !docsAutorizados) && { opacity: 0.6 }]}
            onPress={handleGuardar}
            disabled={guardando || !terminosAceptados || !docsAutorizados}
            activeOpacity={0.8}
          >
            {guardando
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={s.saveText}>{esEdicion ? t('vehicleForm.saveChanges') : t('vehicleForm.registerVehicle')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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

  scroll: { padding: 20, paddingBottom: 40 },

  label: { fontSize: 13, fontWeight: '600', color: C.textMuted, marginBottom: 8 },

  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: C.surface,
  },
  typeChipActive: { borderColor: C.accentGreen, backgroundColor: 'rgba(61,190,122,0.12)' },
  typeLabel: { color: C.textMuted, fontWeight: '600' },
  typeLabelActive: { color: C.accentGreen },

  fieldWrap: { marginBottom: 16 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 10,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { backgroundColor: C.border },
  stepperValue: { fontSize: 20, fontWeight: '700', color: C.text, minWidth: 28, textAlign: 'center' },
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
  inputDisabled: {
    opacity: 0.6,
  },
  fieldHint: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 6,
  },

  // Selector (marca / modelo / año / color)
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  selectText: { fontSize: 15, color: C.text },
  selectPlaceholder: { fontSize: 15, color: C.textMuted },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '65%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  optionText: { fontSize: 15, color: C.text },
  optionTextActive: { color: C.accentGreen, fontWeight: '700' },

  // Cuadros de foto (licencia / tarjeta de propiedad)
  photoBox: {
    height: 150,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.border,
    backgroundColor: C.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBoxFilled: { borderStyle: 'solid', borderColor: C.accentGreen },
  photoEmpty: { alignItems: 'center', paddingHorizontal: 16, gap: 4 },
  photoIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(61,190,122,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  photoCta: { fontSize: 14, fontWeight: '700', color: C.text },
  photoHint: { fontSize: 12, color: C.textMuted, textAlign: 'center' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: { color: C.error, fontSize: 13, marginBottom: 12, textAlign: 'center' },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: C.accent, borderColor: C.accent },
  checkboxMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  termsText: { flex: 1, fontSize: 13, lineHeight: 19, color: C.textMuted },
  termsLink: { color: C.accent, fontWeight: '600' },

  saveBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
}