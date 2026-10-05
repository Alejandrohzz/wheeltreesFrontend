import { useAppTheme } from '@/contexts/ThemeContext';
import { autocompletePlaces, PlacePrediction } from '@/services/places';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DARK_C = {
  surface:   '#1E2126',
  border:    '#2E343C',
  text:      '#FFFFFF',
  textMuted: '#6B7785',
  textSub:   '#9BA3AD',
  accent:    '#4A90D9',
};

const LIGHT_C = {
  surface:   '#FFFFFF',
  border:    '#DDE1E6',
  text:      '#11181C',
  textMuted: '#7A8593',
  textSub:   '#5B6472',
  accent:    '#4A90D9',
};

interface Props {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (prediction: PlacePrediction) => void;
  icon?: ReactNode;
}

export default function PlaceAutocompleteInput({
  label,
  placeholder,
  value,
  onChangeText,
  onSelectPlace,
  icon,
}: Props) {
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = getStyles(C);

  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading]         = useState(false);
  const [focused, setFocused]         = useState(false);
  const [error, setError]             = useState('');
  const sessionToken = useRef(String(Date.now()));
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!focused || value.trim().length < 3) {
      setSuggestions([]);
      setError('');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const results = await autocompletePlaces(value, sessionToken.current);
        setSuggestions(results);
        if (__DEV__ && results.length === 0) {
          console.log('[PlaceAutocomplete] Sin resultados para:', value);
        }
      } catch (e: any) {
        if (__DEV__) console.log('[PlaceAutocomplete] Error:', e?.message ?? e);
        setSuggestions([]);
        setError(e?.message ?? 'No se pudieron cargar las sugerencias');
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, focused]);

  const handleSelect = (p: PlacePrediction) => {
    onChangeText(p.description);
    setSuggestions([]);
    setFocused(false);
    sessionToken.current = String(Date.now()); // nueva sesión tras selección
    onSelectPlace(p);
  };

  return (
    <View style={s.wrap}>
      {!!label && <Text style={s.label}>{label}</Text>}

      <View style={[s.inputRow, focused && s.inputRowFocused]}>
        {!!icon && <View style={s.icon}>{icon}</View>}
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {loading && <ActivityIndicator size="small" color={C.accent} />}
      </View>

      {focused && suggestions.length > 0 && (
        <View style={s.dropdown}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.placeId}
              style={s.suggestionRow}
              activeOpacity={0.7}
              onPress={() => handleSelect(item)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.mainText} numberOfLines={1}>{item.mainText}</Text>
                {!!item.secondaryText && (
                  <Text style={s.secondaryText} numberOfLines={1}>{item.secondaryText}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {focused && !!error && (
        <Text style={s.errorText}>{error}</Text>
      )}
    </View>
  );
}

const getStyles = (C: typeof DARK_C) => StyleSheet.create({
  wrap: { position: 'relative', zIndex: 10 },
  label: { fontSize: 13, fontWeight: '600', color: C.textMuted, marginBottom: 8 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputRowFocused: { borderColor: C.accent },
  icon: { alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 0 },

  dropdown: {
    marginTop: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  mainText: { color: C.text, fontSize: 14, fontWeight: '600' },
  secondaryText: { color: C.textSub, fontSize: 12, marginTop: 2 },
  errorText: { color: '#E05C5C', fontSize: 12, marginTop: 6 },
});
