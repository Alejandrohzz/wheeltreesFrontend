import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export interface SlideToConfirmColors {
  track:        string; // fondo de la barra
  trackBorder:  string;
  fill:         string; // color que va "rellenando" detrás del thumb
  thumb:        string; // color del botón circular que se arrastra
  thumbIcon:    string; // color del ícono/flecha dentro del thumb
  label:        string; // color del texto de la barra
  disabledTrack?: string;
}

export interface SlideToConfirmProps {
  label: string;
  confirmingLabel?: string; // texto mostrado mientras loading=true
  icon?: string; // emoji u otro carácter para el thumb, por defecto "→"
  onConfirm: () => void;
  disabled?: boolean;
  loading?: boolean; // true mientras se procesa la acción (ej. llamada a API)
  colors: SlideToConfirmColors;
  height?: number;
}

/**
 * Botón "desliza para confirmar" tipo Uber/Didi. Pensado para acciones
 * irreversibles o de alto compromiso (ej. iniciar un viaje), donde un tap
 * accidental sería costoso. El usuario debe arrastrar el thumb hasta el
 * final del track para disparar onConfirm.
 *
 * No depende de react-native-gesture-handler: usa PanResponder + Animated
 * (ambos de React Native core) para no requerir envolver la app en un
 * GestureHandlerRootView adicional.
 */
export function SlideToConfirm({
  label,
  confirmingLabel,
  icon = '→',
  onConfirm,
  disabled = false,
  loading = false,
  colors,
  height = 58,
}: SlideToConfirmProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const thumbSize = height - 8; // 4px de padding a cada lado
  const maxTranslate = Math.max(trackWidth - thumbSize - 8, 0);

  const translateX = useRef(new Animated.Value(0)).current;
  const confirmedRef = useRef(false);

  const isLocked = disabled || loading;

  // Cuando termina de cargar (loading pasa de true a false) sin haberse
  // reiniciado la pantalla, regresamos el thumb a su posición inicial.
  useEffect(() => {
    if (!loading && !disabled) {
      confirmedRef.current = false;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 4,
      }).start();
    }
  }, [loading, disabled, translateX]);

  // Mientras loading está activo, dejamos el thumb fijo al final.
  useEffect(() => {
    if (loading && maxTranslate > 0) {
      Animated.timing(translateX, {
        toValue: maxTranslate,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  }, [loading, maxTranslate, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isLocked && maxTranslate > 0,
        onStartShouldSetPanResponderCapture: () => !isLocked && maxTranslate > 0,
        onMoveShouldSetPanResponder: () => !isLocked && maxTranslate > 0,
        onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
          !isLocked && maxTranslate > 0 && Math.abs(gesture.dx) > 2,
        onPanResponderMove: (_evt, gesture) => {
          if (isLocked) return;
          const next = Math.min(Math.max(gesture.dx, 0), maxTranslate);
          translateX.setValue(next);
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (isLocked) return;
          const reached = gesture.dx >= maxTranslate * 0.72;
          if (reached && !confirmedRef.current) {
            confirmedRef.current = true;
            Animated.timing(translateX, {
              toValue: maxTranslate,
              duration: 120,
              useNativeDriver: false,
            }).start(() => onConfirm());
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: false,
              bounciness: 6,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (isLocked || confirmedRef.current) return;
          Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
        },
      }),
    [isLocked, maxTranslate, onConfirm, translateX],
  );

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const fillWidth = Animated.add(translateX, new Animated.Value(thumbSize));
  const labelOpacity = translateX.interpolate({
    inputRange: [0, Math.max(maxTranslate * 0.6, 1)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: isLocked && colors.disabledTrack ? colors.disabledTrack : colors.track,
          borderColor: colors.trackBorder,
          opacity: disabled && !loading ? 0.6 : 1,
        },
      ]}
    >
      {trackWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            {
              height,
              borderRadius: height / 2,
              backgroundColor: colors.fill,
              width: fillWidth,
            },
          ]}
        />
      )}

      <Animated.Text
        pointerEvents="none"
        style={[styles.label, { color: colors.label, opacity: labelOpacity }]}
        numberOfLines={1}
      >
        {loading ? confirmingLabel ?? label : label}
      </Animated.Text>

      {trackWidth > 0 && (
        <Animated.View
          {...(isLocked ? {} : panResponder.panHandlers)}
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: colors.thumb,
              transform: [{ translateX }],
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.thumbIcon} size="small" />
          ) : (
            <Text style={[styles.thumbIcon, { color: colors.thumbIcon }]}>{icon}</Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  thumb: {
    position: 'absolute',
    left: 4,
    top: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  thumbIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
});
