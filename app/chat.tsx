import { useAppTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  conectarChat,
  desconectarChat,
  enviarMensajeRest,
  historialChat,
  marcarLeidos,
  Mensaje,
  suscribirseAPersona,
} from '@/services/chat';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DARK_C = {
  bg:        '#131517',
  card:      '#1E2126',
  bubbleMe:  '#3DBE7A',
  border:    '#2E343C',
  text:      '#FFFFFF',
  textMuted: '#6B7785',
  textSub:   '#9BA3AD',
  accent:    '#4A90D9',
  red:       '#E05C5C',
};

const LIGHT_C = {
  bg: '#F5F7F8',
  card: '#FFFFFF',
  bubbleMe: '#3DBE7A',
  border: '#DDE1E6',
  text: '#11181C',
  textMuted: '#7A8593',
  textSub: '#5B6472',
  accent: '#4A90D9',
  red: '#E05C5C',
};

export default function ChatScreen() {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const { usuario } = useAuth();
  const { otroUsuarioId, otroUsuarioNombre } = useLocalSearchParams<{
    otroUsuarioId: string;
    otroUsuarioNombre?: string;
  }>();

  const [mensajes, setMensajes]   = useState<Mensaje[]>([]);
  const [texto, setTexto]         = useState('');
  const [cargando, setCargando]   = useState(true);
  const [enviando, setEnviando]   = useState(false);
  const [conectado, setConectado] = useState(false);
  const [error, setError]         = useState('');
  const listRef = useRef<FlatList<Mensaje>>(null);

  // 1) Carga el historial por REST apenas se abre la pantalla.
  useEffect(() => {
    if (!otroUsuarioId) return;
    (async () => {
      try {
        const data = await historialChat(otroUsuarioId);
        setMensajes(data);
        marcarLeidos(otroUsuarioId).catch(() => {});
      } catch (e: any) {
        setError(e?.message ?? 'No se pudo cargar la conversación');
      } finally {
        setCargando(false);
      }
    })();
  }, [otroUsuarioId]);

  // 2) Abre el WebSocket SOLO para recibir mensajes en vivo mientras el
  // chat está abierto. El envío (más abajo) NUNCA depende de esto — así el
  // mensaje siempre se guarda, esté o no conectado el otro participante,
  // o esté o no lista todavía esta conexión en tiempo real.
  useEffect(() => {
    if (!otroUsuarioId || !usuario?.id) return;
    let cancelado = false;
    let unsuscribir = () => {};

    conectarChat(
      () => {
        if (cancelado) return;
        setConectado(true);
        unsuscribir = suscribirseAPersona(usuario.id, otroUsuarioId, (nuevo) => {
          setMensajes((prev) =>
            prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo],
          );
        });
      },
      () => {
        // Sin tiempo real por ahora: no es grave, el chat sigue
        // funcionando por REST. Solo no se verán mensajes nuevos hasta
        // refrescar. No se le muestra error al usuario por esto.
        if (!cancelado) setConectado(false);
      },
    );

    return () => {
      cancelado = true;
      unsuscribir();
      desconectarChat();
    };
  }, [otroUsuarioId, usuario?.id]);

  useEffect(() => {
    if (mensajes.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [mensajes.length]);

  // Envío SIEMPRE por REST: se guarda en la base de datos de inmediato,
  // sin importar si el otro participante está conectado o no. Cuando entre,
  // lo va a ver en su historial. Si el WS está activo, el backend también
  // lo retransmite en vivo a quien esté escuchando (incluido este mismo
  // dispositivo, pero ya lo agregamos nosotros abajo así que se descarta
  // el duplicado por id).
  const enviar = useCallback(async () => {
    const contenido = texto.trim();
    if (!contenido || !otroUsuarioId || enviando) return;

    setTexto('');
    setEnviando(true);
    try {
      const nuevo = await enviarMensajeRest(otroUsuarioId, contenido);
      setMensajes((prev) =>
        prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo],
      );
      setError('');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo enviar el mensaje');
      setTexto(contenido); // se devuelve el texto para que no se pierda
    } finally {
      setEnviando(false);
    }
  }, [texto, otroUsuarioId, enviando]);

  const renderItem = ({ item }: { item: Mensaje }) => {
    const esMio = item.remitenteId === usuario?.id;
    return (
      <View style={[s.bubbleRow, esMio ? s.bubbleRowMe : s.bubbleRowOther]}>
        <View style={[s.bubble, esMio ? s.bubbleMe : s.bubbleOther]}>
          <Text style={[s.bubbleText, esMio && s.bubbleTextMe]}>{item.contenido}</Text>
          <Text style={[s.bubbleHora, esMio && s.bubbleHoraMe]}>
            {new Date(item.enviadoEn).toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {otroUsuarioNombre ?? 'Chat'}
          </Text>
          <Text style={s.headerSub}>{conectado ? 'En línea' : 'Sin tiempo real — los mensajes igual se envían'}</Text>
        </View>
      </View>
      <View style={s.headerDivider} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {cargando ? (
          <View style={s.centerBox}>
            <ActivityIndicator color={C.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={mensajes}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={s.lista}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.centerBox}>
                <Text style={s.emptyText}>
                  Todavía no hay mensajes.{'\n'}Escribe el primero 👋
                </Text>
              </View>
            }
          />
        )}

        {!!error && <Text style={s.errorBanner}>{error}</Text>}

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje…"
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!texto.trim() || enviando) && s.sendBtnDisabled]}
            onPress={enviar}
            disabled={!texto.trim() || enviando}
            activeOpacity={0.8}
          >
            {enviando ? (
              <ActivityIndicator size="small" color="#0A0A0A" />
            ) : (
              <Text style={s.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: C.text },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  headerSub:   { fontSize: 11, color: C.textMuted, marginTop: 1 },
  headerDivider: { height: 1, backgroundColor: C.border },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  lista: { padding: 16, gap: 8, flexGrow: 1 },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowMe:    { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleMe:    { backgroundColor: C.bubbleMe, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },

  bubbleText:   { fontSize: 15, color: C.text },
  bubbleTextMe: { color: '#0A0A0A' },
  bubbleHora:   { fontSize: 10, color: C.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  bubbleHoraMe: { color: 'rgba(10,10,10,0.6)' },

  errorBanner: {
    color: C.red,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 6,
    backgroundColor: 'rgba(224,92,92,0.1)',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.bubbleMe,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 17, color: '#0A0A0A', marginLeft: 2 },
});
}
