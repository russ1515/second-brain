import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n } from '../../lib/i18n';
import { theme } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import { FeatureTile } from '../../components/feature-tile';

/** 📅 Study — "what must I do today?". Planning routes to Home (where the day's
 *  plan lives), Revisions/FSRS into the real FSRS queue; goals, exams and
 *  notifications are Coming Soon. Nothing new is coded here. */
export default function StudyScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { maxContentWidth } = useResponsive();
  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
      <Text style={styles.h1}>📅 {t('tab.study')}</Text>
      <Text style={styles.intro}>{t('study.intro')}</Text>

      <View style={styles.grid}>
        <FeatureTile
          emoji="🧑‍🏫"
          title={t('coachp.title')}
          subtitle={t('coachp.tileDetail')}
          onPress={() => router.push('/coach')}
          testID="tile-coach"
        />
        <FeatureTile
          emoji="🎓"
          title={t('ment.title')}
          subtitle={t('ment.tileDetail')}
          onPress={() => router.push('/mentorship')}
          testID="tile-mentorship"
        />
        <FeatureTile
          emoji="📅"
          title={t('study.planning')}
          subtitle={t('plan.tileDetail')}
          onPress={() => router.push('/planner')}
          testID="tile-planning"
        />
        <FeatureTile
          emoji="🎴"
          title={t('study.revision.title')}
          subtitle={t('study.revision.detail')}
          onPress={() => router.push('/revision')}
          testID="tile-revision"
        />
        <FeatureTile
          emoji="🧬"
          title={t('study.fsrs')}
          subtitle={t('study.fsrs.detail')}
          onPress={() => router.push('/revision-engine')}
          testID="tile-fsrs"
        />
        <FeatureTile
          emoji="🗓️"
          title={t('cal.title')}
          subtitle={t('cal.tileDetail')}
          onPress={() => router.push('/calendar')}
          testID="tile-calendar"
        />
        <FeatureTile
          emoji="🔮"
          title={t('pred.title')}
          subtitle={t('pred.tileDetail')}
          onPress={() => router.push('/predictions')}
          testID="tile-predictions"
        />
        <FeatureTile
          emoji="🔭"
          title={t('risk.title')}
          subtitle={t('risk.tileDetail')}
          onPress={() => router.push('/foresight')}
          testID="tile-foresight"
        />
        <FeatureTile
          emoji="🎯"
          title={t('study.goals')}
          subtitle={t('goals.tileDetail')}
          onPress={() => router.push('/goals')}
          testID="tile-goals"
        />
        <FeatureTile
          emoji="📝"
          title={t('study.exams')}
          subtitle={t('exams.tileDetail')}
          onPress={() => router.push('/exams')}
          testID="tile-exams"
        />
        <FeatureTile
          emoji="📊"
          title={t('succ.title')}
          subtitle={t('succ.tileDetail')}
          onPress={() => router.push('/success')}
          testID="tile-success"
        />
        <FeatureTile
          emoji="🔔"
          title={t('study.notifications')}
          subtitle={t('notif.tileDetail')}
          onPress={() => router.push('/notifications')}
          testID="tile-notifications"
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
