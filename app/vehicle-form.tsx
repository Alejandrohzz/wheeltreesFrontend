import { useAppTheme } from '@/contexts/ThemeContext';
import { TipoVehiculo } from '@/services/types';
import { actualizarVehiculo, crearVehiculo, listarVehiculos, VehiculoRequest } from '@/services/vehiculos';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DARK_C = {
  bg:          '#131517',
  surface:     '#1E2126',
  border:      '#2E343C',
  borderFocus: '#4A90D9',
  text:        '#FFFFFF',
  textMuted:   '#6B7785',
  accent:      '#4A90D9',
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
  error: '#E05C5C',
};

const TIPOS: { value: TipoVehiculo; label: string; icon: string }[] = [
  { value: 'MOTO',  label: 'Moto',  icon: '🏍️' },
  { value: 'CARRO', label: 'Carro', icon: '🚗' },
];

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
  colors: typeof DARK_C;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={props.styles.fieldWrap}>
      <Text style={props.styles.label}>{props.label}</Text>
      <TextInput
        style={props.styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={props.colors.textMuted}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
      />
    </View>
  );
}

export default function VehicleFormScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const esEdicion = !!id;

  const [tipo, setTipo]           = useState<TipoVehiculo>('MOTO');
  const [placa, setPlaca]         = useState('');
  const [marca, setMarca]         = useState('');
  const [modelo, setModelo]       = useState('');
  const [anio, setAnio]           = useState('');
  const [color, setColor]         = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [cedula, setCedula]       = useState('');
  const [fotoVehiculo, setFotoVehiculo] = useState('');
  const [terminosAceptados, setTerminosAceptados] = useState(false);

  const [cargandoDatos, setCargandoDatos] = useState(esEdicion);
  const [guardando, setGuardando]         = useState(false);
  const [error, setError]                 = useState('');

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
          setFotoVehiculo(v.fotoVehiculo ?? '');
          setTerminosAceptados(!!v.terminosAceptados);
        }
      } catch (e: any) {
        setError(e?.message ?? 'No se pudo cargar el vehículo');
      } finally {
        setCargandoDatos(false);
      }
    })();
  }, [esEdicion, id]);

  const validar = () => {
    if (!placa.trim())            return 'La placa es obligatoria';
    if (!marca.trim())            return 'La marca es obligatoria';
    if (!modelo.trim())           return 'El modelo es obligatorio';
    if (!anio.trim() || isNaN(Number(anio)))       return 'El año no es válido';
    if (!color.trim())            return 'El color es obligatorio';
    if (!capacidad.trim() || isNaN(Number(capacidad))) return 'La capacidad no es válida';
    if (!cedula.trim())           return 'La cédula del propietario es obligatoria';
    if (!terminosAceptados)       return 'Debes aceptar los términos y condiciones para continuar';
    return null;
  };

  const handleGuardar = async () => {
    setError('');
    const err = validar();
    if (err) { setError(err); return; }

    const body: VehiculoRequest = {
      tipo,
      placa: placa.trim().toUpperCase(),
      marca: marca.trim(),
      modelo: modelo.trim(),
      anio: Number(anio),
      color: color.trim(),
      capacidadPasajeros: Number(capacidad),
      cedulaPropietario: cedula.trim(),
      ...(fotoVehiculo.trim() ? { fotoVehiculo: fotoVehiculo.trim() } : {}),
      terminosAceptados,
    };

    setGuardando(true);
    try {
      if (esEdicion && id) {
        await actualizarVehiculo(id, body);
      } else {
        await crearVehiculo(body);
      }
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar el vehículo');
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
        <Text style={s.headerTitle}>{esEdicion ? 'Editar vehículo' : 'Nuevo vehículo'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.label}>Tipo de vehículo</Text>
          <View style={s.typeRow}>
            {TIPOS.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[s.typeChip, tipo === t.value && s.typeChipActive]}
                onPress={() => setTipo(t.value)}
                activeOpacity={0.7}
              >
                <Text style={s.typeIcon}>{t.icon}</Text>
                <Text style={[s.typeLabel, tipo === t.value && s.typeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field colors={C} styles={s} label="Placa" value={placa} onChangeText={setPlaca} autoCapitalize="characters" placeholder="ABC12D" />
          <Field colors={C} styles={s} label="Marca" value={marca} onChangeText={setMarca} placeholder="Yamaha" />
          <Field colors={C} styles={s} label="Modelo" value={modelo} onChangeText={setModelo} placeholder="Faz" />
          <Field colors={C} styles={s} label="Año" value={anio} onChangeText={setAnio} keyboardType="number-pad" placeholder="2026" />
          <Field colors={C} styles={s} label="Color" value={color} onChangeText={setColor} placeholder="Rojo" />
          <Field colors={C} styles={s} label="Capacidad (pasajeros)" value={capacidad} onChangeText={setCapacidad} keyboardType="number-pad" placeholder="1" />
          <Field colors={C} styles={s} label="Cédula del propietario" value={cedula} onChangeText={setCedula} keyboardType="number-pad" placeholder="3134004216" />
          <Field colors={C} styles={s} label="Foto del vehículo (URL, opcional)" value={fotoVehiculo} onChangeText={setFotoVehiculo} placeholder="https://..." autoCapitalize="none" />

          <TouchableOpacity
            style={s.termsRow}
            onPress={() => setTerminosAceptados((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, terminosAceptados && s.checkboxChecked]}>
              {terminosAceptados && <Text style={s.checkboxMark}>✓</Text>}
            </View>
            <Text style={s.termsText}>
              Declaro que el vehículo tiene todos sus documentos al día (SOAT vigente, revisión
              tecnomecánica cuando aplique, licencia de conducción vigente y tarjeta de
              propiedad), y acepto los{' '}
              <Text style={s.termsLink}>términos y condiciones</Text> de uso de la plataforma.
            </Text>
          </TouchableOpacity>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[s.saveBtn, (guardando || !terminosAceptados) && { opacity: 0.6 }]}
            onPress={handleGuardar}
            disabled={guardando || !terminosAceptados}
            activeOpacity={0.8}
          >
            {guardando
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={s.saveText}>{esEdicion ? 'Guardar cambios' : 'Registrar vehículo'}</Text>}
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
  typeChipActive: { borderColor: C.accent, backgroundColor: 'rgba(74,144,217,0.12)' },
  typeIcon: { fontSize: 16 },
  typeLabel: { color: C.textMuted, fontWeight: '600' },
  typeLabelActive: { color: C.accent },

  fieldWrap: { marginBottom: 16 },
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
