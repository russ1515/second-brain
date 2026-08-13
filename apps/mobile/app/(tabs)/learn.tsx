import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n } from '../../lib/i18n';
import { theme } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import { FeatureTile } from '../../components/feature-tile';

/** 📚 Learn — the acquisition space. Real tiles route into existing screens
 *  (teacher, scanner, languages); features without a screen yet show as
 *  Coming Soon so the structure is complete. Nothing new is coded here. */
export default function LearnScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { maxContentWidth } = useResponsive();
  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
      <Text style={styles.h1}>📚 {t('tab.learn')}</Text>
      <Text style={styles.intro}>{t('learn.intro')}</Text>

      <View style={styles.grid}>
        <FeatureTile
          emoji="✨"
          title={t('reco.title')}
          subtitle={t('reco.tileDetail')}
          onPress={() => router.push('/for-you')}
          testID="tile-for-you"
        />
        <FeatureTile
          emoji="💬"
          title={t('learn.teacher.title')}
          subtitle={t('learn.teacher.detail')}
          onPress={() => router.push('/tutor')}
          testID="tile-teacher"
        />
        <FeatureTile
          emoji="🧭"
          title={t('apath.title')}
          subtitle={t('apath.tileDetail')}
          onPress={() => router.push('/adaptive-path')}
          testID="tile-adaptive-path"
        />
        <FeatureTile
          emoji="📷"
          title={t('learn.ocr')}
          subtitle={t('learn.scan.detail')}
          onPress={() => router.push('/scan')}
          testID="tile-ocr"
        />
        <FeatureTile
          emoji="📚"
          title={t('lib.title')}
          subtitle={t('lib.tileDetail')}
          onPress={() => router.push('/library')}
          testID="tile-documents"
        />
        <FeatureTile
          emoji="🗣️"
          title={t('learn.languages.title')}
          subtitle={t('learn.languages.detail')}
          onPress={() => router.push('/languages')}
          testID="tile-languages"
        />
        <FeatureTile
          emoji="✍️"
          title={t('learn.writing.title')}
          subtitle={t('learn.writing.detail')}
          onPress={() => router.push('/writing')}
          testID="tile-writing"
        />
        <FeatureTile
          emoji="📖"
          title={t('learn.reading.title')}
          subtitle={t('learn.reading.detail')}
          onPress={() => router.push('/reading')}
          testID="tile-reading"
        />
        <FeatureTile
          emoji="📝"
          title={t('learn.assessments')}
          subtitle={t('learn.assessments.detail')}
          onPress={() => router.push('/examiner')}
          testID="tile-assessments"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 30, fontWeight: '700', color: theme.text },
  intro: { fontSize: 15, color: theme.textMuted, marginBottom: 4, lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
