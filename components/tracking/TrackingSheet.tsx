import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackColors } from './theme';

const ASA = 28; // alto de la zona del "agarrador"

interface Props {
  C: TrackColors;
  /** Siempre visible (también colapsado). Arrastrarlo abre/cierra el sheet. */
  header: ReactNode;
  /** Contenido que aparece al expandir. */
  children?: ReactNode;
  /** Se llama con el alto visible cuando está colapsado (para el padding del mapa). */
  onAltoColapsado?: (alto: number) => void;
  /** Fracción de pantalla que ocupa expandido. */
  ratioExpandido?: number;
}

/**
 * Bottom sheet estilo Uber: se ve el resumen y se arrastra hacia arriba
 * para ver el detalle.
 */
export default function TrackingSheet({
  C, header, children, onAltoColapsado, ratioExpandido = 0.7,
}: Props) {
  const { height: alturaPantalla } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [altoHeader, setAltoHeader] = useState(0);
  const [expandido, setExpandido] = useState(false);
  const ty = useRef(new Animated.Value(0)).current;
  const yActual = useRef(0);

  const visibleColapsado = ASA + altoHeader + insets.bottom;
  const altoSheet = Math.max(alturaPantalla * ratioExpandido, visibleColapsado + 160);
  const yColapsado = Math.max(0, altoSheet - visibleColapsado);

  // Valores que necesita el PanResponder (se crea una sola vez).
  const refs = useRef({ yColapsado, expandido });
  refs.current = { yColapsado, expandido };

  const irA = (expandir: boolean) => {
    setExpandido(expandir);
    Animated.spring(ty, {
      toValue: expandir ? 0 : refs.current.yColapsado,
      useNativeDriver: false,
      bounciness: 4,
      speed: 14,
    }).start();
  };

  // Al medir (o cambiar el alto del header) reubica el sheet en su posición actual.
  useEffect(() => {
    if (altoHeader === 0) return;
    ty.setValue(refs.current.expandido ? 0 : yColapsado);
    onAltoColapsado?.(visibleColapsado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [altoHeader, yColapsado]);

  useEffect(() => {
    const id = ty.addListener(({ value }) => { yActual.current = value; });
    return () => ty.removeListener(id);
  }, [ty]);

  const pan = useMemo(() => {
    let inicio = 0;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => { inicio = yActual.current; },
      onPanResponderMove: (_, g) => {
        const y = Math.min(refs.current.yColapsado, Math.max(0, inicio + g.dy));
        ty.setValue(y);
      },
      onPanResponderRelease: (_, g) => {
        const { yColapsado: yc } = refs.current;
        const mitad = yc / 2;
        const expandir = g.vy < -0.4 ? true : g.vy > 0.4 ? false : yActual.current < mitad;
        setExpandido(expandir);
        Animated.spring(ty, {
          toValue: expandir ? 0 : yc,
          useNativeDriver: false,
          bounciness: 4,
          speed: 14,
        }).start();
      },
    });
  }, [ty]);

  const medido = altoHeader > 0;
  const s = useMemo(() => estilos(C), [C]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        s.sheet,
        { height: altoSheet, transform: [{ translateY: ty }], opacity: medido ? 1 : 0 },
      ]}
    >
      <View {...pan.panHandlers}>
        <TouchableWithoutFeedback onPress={() => irA(!expandido)}>
          <View style={s.asaZona}><View style={s.asa} /></View>
        </TouchableWithoutFeedback>
        <View onLayout={(e: LayoutChangeEvent) => setAltoHeader(Math.ceil(e.nativeEvent.layout.height))}>
          {header}
        </View>
      </View>

      <ScrollView
        style={s.cuerpo}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        scrollEnabled={expandido}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

function estilos(C: TrackColors) {
  return StyleSheet.create({
    sheet: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      backgroundColor: C.sheet,
      borderTopLeftRadius: 18, borderTopRightRadius: 18,
      elevation: 16,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: -3 },
    },
    asaZona: { height: ASA, alignItems: 'center', justifyContent: 'center' },
    asa: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border },
    cuerpo: { flex: 1 },
  });
}
