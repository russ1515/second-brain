import { useState } from 'react';
import { Text, View } from 'react-native';
import type { BrainLanguageBulletinEntry } from '../../lib/brain-language-bulletins';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { LanguageMasteryBulletinCard } from '../language/course-ui';
import { ResponsiveGrid, Section } from '../ds/layout';

export function BrainLanguageBulletinGrid({ entries }: { entries: BrainLanguageBulletinEntry[] }) {
  const { t } = useI18n();
  const { colors: c, typography } = useTokens();
  const [openId, setOpenId] = useState<string | null>(null);
  const cards = entries.flatMap(({ profile, course }) => course.kind === 'live'
    ? course.course.masteryBulletins.map((bulletin) => ({
        id: `${profile.id}:${bulletin.level}:${bulletin.mappingVersion}`,
        profile,
        bulletin,
        units: course.course.units,
      }))
    : []);

  if (cards.length === 0) return null;

  return (
    <Section title={t('brainV1.bulletin.section')} description={t('brainV1.bulletin.sectionDetail')}>
      <Text style={[typography.caption, { color: c.textMuted }]}>{t('brainV1.bulletin.oneOpen')}</Text>
      <ResponsiveGrid maxColumns={3} style={{ alignItems: 'flex-start' }}>
        {cards.map(({ id, profile, bulletin, units }) => (
          <View key={id} style={{ width: '100%' }}>
            <LanguageMasteryBulletinCard
              bulletin={bulletin}
              units={units}
              language={profile.language}
              updatedAt={profile.lastActivityAt ?? profile.updatedAt}
              expanded={openId === id}
              onToggle={() => setOpenId((current) => current === id ? null : id)}
            />
          </View>
        ))}
      </ResponsiveGrid>
    </Section>
  );
}
