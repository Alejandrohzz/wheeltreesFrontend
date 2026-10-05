import { useAppTheme } from '@/contexts/ThemeContext';
import { getTerminos } from '@/constants/terminos';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DARK_C = {
  bg: '#131517', surface: '#1E2126', border: '#2E343C',
  text: '#FFFFFF', textMuted: '#6B7785', textSub: '#9BA3AD', accent: '#4A90D9',
};
const LIGHT_C = {
  bg: '#F5F7F8', surface: '#FFFFFF', border: '#DDE1E6',
  text: '#11181C', textMuted: '#7A8593', textSub: '#5B6472', accent: '#4A90D9',
};

export default function TermsScreen() {
  const { t, i18n } = useTranslation();
  const { isDark } = useAppTheme();
  const C = isDark ? DARK_C : LIGHT_C;
  const s = useMemo(() => createStyles(C), [C]);
  const router = useRouter();
  const terminos = getTerminos(i18n.language);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('terms.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.docTitle}>{terminos.titulo}</Text>
        <Text style={s.meta}>{terminos.actualizado} · v{terminos.version}</Text>
        <Text style={s.paragraph}>{terminos.intro}</Text>

        {terminos.secciones.map((sec) => (
          <View key={sec.titulo} style={s.section}>
            <Text style={s.sectionTitle}>{sec.titulo}</Text>
            {sec.parrafos.map((p, i) => (
              <Text key={i} style={s.paragraph}>{p}</Text>
            ))}
          </View>
        ))}

        <Text style={[s.paragraph, s.closing]}>{terminos.cierre}</Text>

        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={s.closeText}>{t('terms.close')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(C: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backIcon: { fontSize: 22, color: C.text },
    headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
    scroll: { padding: 20, paddingBottom: 48 },
    docTitle: { fontSize: 20, fontWeight: '800', color: C.text, lineHeight: 26 },
    meta: { fontSize: 12, color: C.textMuted, marginTop: 6, marginBottom: 14 },
    section: { marginTop: 18 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: C.accent, marginBottom: 6 },
    paragraph: { fontSize: 14, lineHeight: 21, color: C.textSub, marginBottom: 8 },
    closing: { marginTop: 22, fontWeight: '600', color: C.text },
    closeBtn: {
      marginTop: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    },
    closeText: { color: C.text, fontWeight: '700', fontSize: 15 },
  });
}
