import { Text, View } from 'react-native';
import {
  SUPPORTED_LANGUAGES,
  type LearnerPassportView,
  type SupportedLanguageCode,
} from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Badge, Button, Card } from '../ds/core';
import { LanguageBadge } from '../ds/language';

const AGE_KEY = {
  under12: 'onb.age.under12',
  '12to15': 'onb.age.12to15',
  '16to18': 'onb.age.16to18',
  '18to25': 'onb.age.18to25',
  '25to40': 'onb.age.25to40',
  over40: 'onb.age.over40',
} as const satisfies Record<NonNullable<LearnerPassportView['declared']['ageBand']>, TranslationKey>;

function languageName(code: SupportedLanguageCode | null): string {
  return code ? SUPPORTED_LANGUAGES[code]?.name ?? code : '—';
}

/** A learner-facing summary of declared context and genuinely observed data. */
export function LearnerPassportCard({
  passport,
  onEdit,
}: {
  passport: LearnerPassportView | null;
  onEdit: () => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const declared = passport?.declared;
  const observed = passport?.observed;
  const education = declared?.education;
  const knownLanguages = declared?.knownLanguages ?? [];
  const progress = observed?.languageProgress ?? [];
  const curriculum = [education?.field, education?.domain, education?.specialty]
    .filter(Boolean)
    .join(' · ') || '—';
  const academicLevel = [education?.level, education?.year, education?.system]
    .filter(Boolean)
    .join(' · ') || '—';
  const teachingPreference = declared?.teacher?.learningSupport
    ? t(`profile.teacher.learning.${declared.teacher.learningSupport}` as TranslationKey)
    : t('profile.teacher.learning.balanced');

  return (
    <Card style={{ gap: 16 }} testID="learner-passport-card">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: '800' }}>{t('passport.title')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>{t('passport.detail')}</Text>
        </View>
        <Badge tone="neutral" label={t('passport.source.declared')} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <PassportFact label={t('onb.identity.age')} value={declared?.ageBand ? t(AGE_KEY[declared.ageBand]) : '—'} />
        <PassportFact label={t('passport.originCountry')} value={declared?.countryOfOrigin ?? '—'} />
        <PassportFact label={t('passport.currentCountry')} value={declared?.currentCountry ?? '—'} />
        <PassportFact label={t('onb.languages.interface')} value={languageName(declared?.interfaceLanguage ?? null)} />
        <PassportFact label={t('onb.languages.native')} value={languageName(declared?.nativeOrPrimaryLanguage ?? null)} />
        <PassportFact label={t('onb.languages.explanation')} value={languageName(declared?.explanationLanguage ?? null)} />
        <PassportFact label={t('passport.teachingLanguage')} value={languageName(declared?.teachingLanguage ?? null)} />
        <PassportFact label={t('onb.academic.title')} value={curriculum} />
        <PassportFact label={t('onb.academic.level')} value={academicLevel} />
        <PassportFact label={t('onb.twin.subjects')} value={declared?.subjects.join(' · ') || '—'} />
        <PassportFact label={t('onb.twin.goals')} value={declared?.academicGoals.join(' · ') || '—'} />
        <PassportFact label={t('passport.timezone')} value={declared?.timezone || '—'} />
        <PassportFact label={t('profile.teacher.learning')} value={teachingPreference} />
      </View>

      {knownLanguages.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
            {t('passport.knownLanguages')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {knownLanguages.map((item) => (
              <View key={`${item.language}-${item.level ?? ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <LanguageBadge code={item.language} />
                {item.level ? <Badge tone="neutral" label={item.level} /> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: 14, gap: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 }}>{t('passport.progression')}</Text>
          <Badge tone="ai" label={t('passport.source.observed')} />
        </View>
        {progress.length ? progress.map((item) => (
          <View key={item.profileId} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            {item.languageCode ? <LanguageBadge code={item.languageCode} /> : <Text style={{ color: c.textPrimary }}>{item.language}</Text>}
            <Badge
              tone={item.evaluatedLevel ? 'success' : 'neutral'}
              label={item.evaluatedLevel ?? item.declaredLevel}
            />
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              {item.lessonCount} · {item.sessionCount}
            </Text>
          </View>
        )) : (
          <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('profile.kyc.languagesEmpty')}</Text>
        )}
      </View>

      <Button label={t('profile.edit')} variant="secondary" icon="→" onPress={onEdit} />
    </Card>
  );
}

function PassportFact({ label, value }: { label: string; value: string }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ flexGrow: 1, flexBasis: 190, gap: 3, borderRadius: radius.sm, backgroundColor: c.surfaceSunken, padding: 10 }}>
      <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '700', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
