import { Text, View } from 'react-native';
import type {
  LanguageMasteryPillar,
  LanguageProfileSummary,
  RlleCanDoCapability,
  RlleCourseView,
  RlleCurriculumUnit,
  RlleCurriculumUnitTemplate,
  RlleLevelMasteryBulletin,
  RlleNotionMasteryStatus,
  RlleLessonOutline,
  RlleMissionCategory,
  RlleWorldMissionTemplate,
} from '@second-brain/shared';
import { LANGUAGE_MASTERY_PILLARS } from '@second-brain/shared';
import { Alert, Badge, Button, Card, Progress } from '../ds/core';
import { useTokens } from '../../lib/design/theme';
import { useRlleCopy } from '../../lib/language-rll-i18n';
import type { RlleCourseLoad, RlleMissionCatalogItem } from '../../lib/language-rll-client';

type CurriculumItem = RlleCurriculumUnit | RlleCurriculumUnitTemplate;

function hasTrackedStatus(unit: CurriculumItem): unit is RlleCurriculumUnit {
  return 'status' in unit;
}

export function CourseEntryCard({
  profile,
  course,
  onOpen,
}: {
  profile: LanguageProfileSummary;
  course: RlleCourseLoad | null;
  onOpen: () => void;
}) {
  const { copy, formatLocale } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const live = course?.kind === 'live' ? course.course : null;
  const resumable = live?.status === 'active' || live?.status === 'paused';
  const title = copy(resumable ? 'rlle.ui.hub.resume' : 'rlle.ui.hub.learn', { language: profile.language });
  const lastActivity = live?.lastActivityAt ?? profile.lastActivityAt;

  return (
    <Card elevated style={{ gap: spacing.md, borderColor: c.aiAccent }} testID="language-course-entry">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Badge label={copy('rlle.ui.badge')} tone="ai" />
        <Badge label={`${live?.level.declared ?? profile.cefrLevel} · ${copy('rlle.ui.course.level.declared')}`} tone="info" />
      </View>
      <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{title}</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('rlle.ui.hub.courseDetail')}</Text>
      {live?.currentLesson ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.label, { color: c.textMuted }]}>{copy('rlle.ui.lesson.title')}</Text>
          <Text style={[typography.title, { color: c.textPrimary }]}>{live.currentLesson.title}</Text>
          <Text style={[typography.caption, { color: c.textSecondary }]}>{live.currentLesson.communicativeObjective}</Text>
        </View>
      ) : null}
      {live?.progress.percent != null ? (
        <View style={{ gap: spacing.xs }}>
          <Progress value={live.progress.percent} tone="ai" />
          <Text style={[typography.caption, { color: c.textMuted }]}>
            {copy('rlle.ui.course.progressUnits', { done: live.progress.completedUnits, total: live.progress.totalUnits })}
          </Text>
        </View>
      ) : null}
      <Text style={[typography.caption, { color: c.textMuted }]}>
        {lastActivity
          ? copy('rlle.ui.course.lastActivity', { date: new Intl.DateTimeFormat(formatLocale, { dateStyle: 'medium' }).format(new Date(lastActivity)) })
          : copy('rlle.ui.course.noActivity')}
      </Text>
      {course?.kind === 'preview' ? <Text style={[typography.caption, { color: c.warning }]}>{copy('rlle.ui.hub.courseUnavailable')}</Text> : null}
      <Button testID="language-course-open" label={resumable ? copy('rlle.ui.course.resume') : copy('rlle.ui.hub.openCourse')} variant="ai" onPress={onOpen} />
    </Card>
  );
}

export function LevelSummary({ course }: { course: RlleCourseView }) {
  const { copy, formatLocale } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const levelRows = [
    { key: 'declared', level: course.level.declared, evidence: null },
    { key: 'estimated', level: course.level.estimated?.level ?? null, evidence: course.level.estimated },
    { key: 'evaluated', level: course.level.evaluated?.level ?? null, evidence: course.level.evaluated },
    { key: 'target', level: course.level.target, evidence: null },
  ] as const;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{copy('rlle.ui.course.levels')}</Text>
      {levelRows.map((row) => (
        <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy(`rlle.ui.course.level.${row.key}`)}</Text>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Badge label={row.level ?? copy('rlle.ui.course.notEvaluated')} tone={row.key === 'evaluated' && row.level ? 'success' : 'neutral'} />
            {row.evidence ? (
              <Text style={[typography.caption, { color: c.textMuted }]}>
                {copy('rlle.ui.course.evidenceCount', { count: row.evidence.evidenceCount })} · {new Intl.DateTimeFormat(formatLocale, { dateStyle: 'short' }).format(new Date(row.evidence.measuredAt))}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

const PILLAR_COPY: Record<LanguageMasteryPillar, string> = {
  'communication-situations': 'rlle.ui.bulletin.pillar.communication',
  'grammar-structures': 'rlle.ui.bulletin.pillar.grammar',
  'verbal-system-conjugation': 'rlle.ui.bulletin.pillar.verbal',
  'vocabulary-target-lexicon': 'rlle.ui.bulletin.pillar.vocabulary',
  'orthography-graphy-phonetics': 'rlle.ui.bulletin.pillar.graphy',
};

const STATUS_COPY: Record<RlleNotionMasteryStatus, string> = {
  MASTERED: 'rlle.ui.bulletin.status.mastered',
  NOT_MASTERED: 'rlle.ui.bulletin.status.notMastered',
  IN_PROGRESS: 'rlle.ui.bulletin.status.inProgress',
  NOT_EVALUABLE: 'rlle.ui.bulletin.status.notEvaluable',
};

/** Server-authoritative notion mastery. This component only groups and renders
 * the supplied projection; it never derives a score, status or unlock. */
export function LanguageMasteryBulletins({
  bulletins,
  units,
  language,
}: {
  bulletins: readonly RlleLevelMasteryBulletin[];
  units: readonly RlleCurriculumUnit[];
  language: string;
}) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const unitById = new Map(units.map((unit) => [unit.id, unit]));

  if (bulletins.length === 0) return null;

  return (
    <View style={{ gap: spacing.md }} testID="language-mastery-bulletins">
      {bulletins.map((bulletin) => (
        <Card key={`${bulletin.languageCode}:${bulletin.level}:${bulletin.mappingVersion}`} elevated style={{ gap: spacing.md, borderColor: c.aiAccent }} testID={`language-mastery-bulletin-${bulletin.level}`}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <View style={{ gap: spacing.xs, flex: 1 }}>
              <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{copy('rlle.ui.bulletin.title')}</Text>
              <Text style={[typography.caption, { color: c.textSecondary }]}>{language} · {bulletin.level}</Text>
            </View>
            <Badge
              label={copy(bulletin.notionGateUnlocked ? 'rlle.ui.bulletin.thresholdReached' : 'rlle.ui.bulletin.thresholdPending')}
              tone={bulletin.notionGateUnlocked ? 'success' : 'info'}
            />
          </View>
          <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('rlle.ui.bulletin.detail')}</Text>
          {bulletin.notionGateUnlocked && bulletin.strictCertification.unlocked === false ? (
            <Alert
              tone="warning"
              title={copy('rlle.ui.capabilities.blocked')}
              detail={copy('rlle.ui.capabilities.blockedDetail')}
            />
          ) : null}
          <Progress value={bulletin.displayPercent} tone="ai" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <BulletinMetric value={`${bulletin.displayPercent}%`} label={copy('ai.progress')} />
            <BulletinMetric value={String(bulletin.masteredRequiredNotions)} label={copy('rlle.ui.bulletin.mastered')} />
            <BulletinMetric value={String(bulletin.toStrengthenRequiredNotions)} label={copy('rlle.ui.bulletin.reinforce')} />
          </View>
          {LANGUAGE_MASTERY_PILLARS.map((pillar) => {
            const notions = bulletin.notions.filter((notion) => notion.pillar === pillar);
            if (notions.length === 0) return null;
            return (
              <View key={pillar} style={{ gap: spacing.sm }} testID={`language-bulletin-pillar-${pillar}`}>
                <Badge label={copy(PILLAR_COPY[pillar])} tone="neutral" />
                {notions.map((notion) => {
                  const unit = unitById.get(notion.unitId);
                  const curriculumFallback = copy('rlle.ui.course.curriculum');
                  const unitLabel = unit
                    ? localizedLabel(copy, unit.titleCode, curriculumFallback)
                    : curriculumFallback;
                  const notionLabel = localizedLabel(
                    copy,
                    `rlle.ui.strand.${notion.sourceStrand}`,
                    unitLabel,
                  );
                  return (
                    <View
                      key={notion.notionId}
                      style={{ borderLeftWidth: 2, borderLeftColor: notionStatusColor(notion.status, c), paddingLeft: spacing.sm, gap: 2 }}
                      testID={`language-notion-${notion.notionId}`}
                    >
                      <Text style={[typography.caption, { color: c.textMuted }]}>
                        {unitLabel}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                        <Text style={[typography.bodySmall, { color: c.textPrimary, flex: 1 }]}>{notionLabel}</Text>
                        <Badge label={copy(STATUS_COPY[notion.status])} tone={notionStatusTone(notion.status)} />
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </Card>
      ))}
    </View>
  );
}

function localizedLabel(
  copy: (key: string) => string,
  key: string,
  fallback: string,
): string {
  const value = copy(key);
  return value === key || value.trim().length === 0 ? fallback : value;
}

function BulletinMetric({ value, label }: { value: string; label: string }) {
  const { colors: c, typography } = useTokens();
  return (
    <View style={{ minWidth: 88, gap: 2 }}>
      <Text style={[typography.h3, { color: c.textPrimary }]}>{value}</Text>
      <Text style={[typography.caption, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

function notionStatusTone(status: RlleNotionMasteryStatus): 'success' | 'warning' | 'info' | 'neutral' {
  if (status === 'MASTERED') return 'success';
  if (status === 'NOT_MASTERED') return 'warning';
  if (status === 'IN_PROGRESS') return 'info';
  return 'neutral';
}

function notionStatusColor(status: RlleNotionMasteryStatus, colors: ReturnType<typeof useTokens>['colors']): string {
  if (status === 'MASTERED') return colors.success;
  if (status === 'NOT_MASTERED') return colors.warning;
  if (status === 'IN_PROGRESS') return colors.info;
  return colors.border;
}

export function CurriculumMap({
  units,
  tracked,
  onOpenUnit,
}: {
  units: readonly CurriculumItem[];
  tracked: boolean;
  onOpenUnit: (unit: CurriculumItem) => void;
}) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <View style={{ gap: spacing.sm }} testID="rll-curriculum">
      {units.map((unit, index) => {
        const status = hasTrackedStatus(unit) ? unit.status : 'untracked';
        const disabled = status === 'locked' || !tracked;
        const marker = status === 'completed' ? '✓' : status === 'in-progress' ? '→' : status === 'locked' ? '⌁' : '○';
        return (
          <Card key={unit.id} style={{ gap: spacing.sm, opacity: status === 'locked' ? 0.62 : 1 }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <View
                accessibilityLabel={copy(`rlle.ui.course.status.${status}`)}
                style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: status === 'completed' ? c.successSoft : status === 'in-progress' ? c.aiAccentSoft : c.surfaceSunken }}
              >
                <Text style={{ color: status === 'completed' ? c.success : c.textSecondary, fontWeight: '800' }}>{marker}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
                  <Badge label={unit.level} tone="info" />
                  {'priority' in unit ? <Badge label={copy(unit.priority === 'goal' ? 'rlle.ui.course.goalPriority' : 'rlle.ui.course.core')} tone={unit.priority === 'goal' ? 'ai' : 'neutral'} /> : null}
                  <Badge label={copy(`rlle.ui.course.status.${status}`)} tone={status === 'completed' ? 'success' : status === 'in-progress' ? 'ai' : 'neutral'} />
                </View>
                <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{index + 1}. {copy(unit.titleCode)}</Text>
                <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy(unit.objectiveCode)}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {unit.strands.map((strand) => <Badge key={strand} label={copy(`rlle.ui.strand.${strand}`)} />)}
                </View>
                {!disabled ? <Button size="sm" variant="secondary" label={copy('rlle.ui.course.unit.open')} onPress={() => onOpenUnit(unit)} /> : null}
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

export function DimensionProgress({ course }: { course: RlleCourseView }) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{copy('rlle.ui.course.dimensions')}</Text>
      {course.progress.dimensions.map((dimension) => (
        <View key={dimension.dimension} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
          <Text style={[typography.bodySmall, { color: c.textPrimary, flex: 1 }]}>{copy(`rlle.ui.dimension.${dimension.dimension}`)}</Text>
          <Badge
            label={copy(`rlle.ui.dimension.status.${dimension.status}`)}
            tone={dimension.status === 'consistent' || dimension.status === 'demonstrated' ? 'success' : dimension.status === 'emerging' ? 'info' : 'neutral'}
          />
          {dimension.evidenceCount > 0 ? <Text style={[typography.caption, { color: c.textMuted }]}>{dimension.evidenceCount}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

export function LessonStages({ outline, onStage }: { outline: RlleLessonOutline; onStage: (kind: RlleLessonOutline['stages'][number]['kind']) => void }) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <View style={{ gap: spacing.sm }} testID="rll-lesson-stages">
      {outline.stages.map((stage, index) => (
        <Card key={`${stage.kind}-${index}`} style={{ gap: spacing.xs, borderColor: stage.status === 'active' ? c.aiAccent : c.borderSubtle }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={[typography.title, { color: stage.status === 'completed' ? c.success : c.textPrimary }]}>{stage.status === 'completed' ? '✓' : stage.status === 'active' ? '→' : '○'}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.title, { color: c.textPrimary }]}>{copy(stage.labelCode || `rlle.ui.stage.${stage.kind}`)}</Text>
              <Text style={[typography.caption, { color: c.textMuted }]}>{copy(`rlle.ui.stage.status.${stage.status}`)}</Text>
            </View>
            {stage.status === 'active' ? <Button size="sm" variant="ai" label={copy('rlle.ui.lesson.stageAction')} onPress={() => onStage(stage.kind)} /> : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

export function MissionList({
  items,
  selectedCategory,
  onStart,
}: {
  items: readonly (RlleMissionCatalogItem | RlleWorldMissionTemplate)[];
  selectedCategory: RlleMissionCategory | 'all';
  onStart: (mission: RlleWorldMissionTemplate) => void;
}) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <View style={{ gap: spacing.sm }} testID="rll-world-missions">
      {items.filter((mission) => selectedCategory === 'all' || mission.category === selectedCategory).map((mission) => {
        const catalog = 'attempt' in mission ? mission : null;
        const attempt = catalog?.attempt ?? null;
        const unavailable = catalog ? catalog.available !== true : false;
        const resumable = attempt != null && ['active', 'paused', 'needs-retry'].includes(attempt.status);
        return (
          <Card key={mission.id} style={{ gap: spacing.sm, opacity: unavailable ? 0.6 : 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Badge label={copy(`rlle.ui.category.${mission.category}`)} tone="info" />
              <Badge label={copy('rlle.ui.mission.minimum', { level: mission.minimumLevel })} />
            </View>
            <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{copy(mission.titleCode)}</Text>
            <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy(mission.objectiveCode)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {mission.strands.map((strand) => <Badge key={strand} label={copy(`rlle.ui.strand.${strand}`)} />)}
            </View>
            {mission.survivalSkills.length ? (
              <View style={{ gap: spacing.xs }}>
                <Text style={[typography.label, { color: c.textMuted }]}>{copy('rlle.ui.mission.survival')}</Text>
                {mission.survivalSkills.map((skill) => <Text key={skill} style={[typography.caption, { color: c.textSecondary }]}>• {copy(`rlle.ui.survival.${skill}`)}</Text>)}
              </View>
            ) : null}
            <Button
              variant={resumable ? 'ai' : 'secondary'}
              label={copy(resumable ? 'rlle.ui.mission.resume' : 'rlle.ui.mission.start')}
              disabled={unavailable}
              onPress={() => onStart(mission)}
            />
          </Card>
        );
      })}
    </View>
  );
}

export function CanDoList({ items }: { items: readonly RlleCanDoCapability[] }) {
  const { copy, formatLocale } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <View style={{ gap: spacing.sm }} testID="rll-can-do-map">
      {items.map((capability) => (
        <Card key={capability.id} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <Text accessibilityElementsHidden style={[typography.h3, { color: capability.status === 'validated' ? c.success : c.textMuted }]}>{capability.status === 'validated' ? '✓' : '○'}</Text>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                <Badge label={copy(`rlle.ui.category.${capability.category}`)} />
                <Badge
                  label={copy(`rlle.ui.cando.status.${capability.status}`)}
                  tone={capability.status === 'validated' ? 'success' : capability.status === 'in-progress' ? 'info' : 'neutral'}
                />
              </View>
              <Text style={[typography.title, { color: c.textPrimary }]}>{copy(capability.labelCode)}</Text>
              {capability.evidence.length ? capability.evidence.slice(0, 3).map((evidence) => (
                <View key={evidence.id} style={{ borderLeftWidth: 2, borderLeftColor: evidence.result === 'demonstrated' ? c.success : c.warning, paddingLeft: spacing.sm, gap: 2 }}>
                  <Text style={[typography.caption, { color: c.textMuted }]}>{copy(`rlle.ui.cando.source.${evidence.source}`)} · {new Intl.DateTimeFormat(formatLocale, { dateStyle: 'short' }).format(new Date(evidence.observedAt))}</Text>
                  <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{evidence.observation}</Text>
                </View>
              )) : <Text style={[typography.caption, { color: c.textMuted }]}>{copy('rlle.ui.cando.noEvidence')}</Text>}
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

export function RecoveryPanel({ course }: { course: RlleCourseView }) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const hasRecovery = course.gaps.length > 0 || course.mistakeMemory.length > 0 || course.repairLoops.length > 0;
  return (
    <Card style={{ gap: spacing.md }} testID="rll-recovery">
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{copy('rlle.ui.recovery.title')}</Text>
        <Text style={[typography.caption, { color: c.textSecondary }]}>{copy('rlle.ui.recovery.subtitle')}</Text>
      </View>
      {!hasRecovery ? <Text style={[typography.bodySmall, { color: c.textMuted }]}>{copy('rlle.ui.recovery.empty')}</Text> : null}
      {course.gaps.map((gap) => (
        <View key={gap.id} style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <Badge label={copy(`rlle.ui.dimension.${gap.kind}`)} tone="warning" />
            <Badge label={copy(`rlle.ui.gap.status.${gap.status}`)} />
          </View>
          <Text style={[typography.bodySmall, { color: c.textPrimary }]}>{gap.label}</Text>
        </View>
      ))}
      {course.mistakeMemory.map((mistake) => (
        <View key={mistake.id} style={{ borderLeftWidth: 2, borderLeftColor: c.warning, paddingLeft: spacing.sm, gap: 2 }}>
          <Text style={[typography.label, { color: c.textPrimary }]}>{mistake.pattern}</Text>
          <Text style={[typography.caption, { color: c.textSecondary }]}>{mistake.learnerExample} → {mistake.correction}</Text>
          <Text style={[typography.caption, { color: c.textMuted }]}>{copy('rlle.ui.recovery.occurrences', { count: mistake.occurrenceCount })}</Text>
        </View>
      ))}
      {course.repairLoops.map((loop) => (
        <Text key={loop.mistakeId} style={[typography.bodySmall, { color: c.textSecondary }]}>
          {copy('rlle.ui.recovery.next', { stage: copy(`rlle.ui.repair.${loop.currentStage}`) })}
        </Text>
      ))}
    </Card>
  );
}

export function BrainLanguageEvidence({
  course,
  onOpenCourse,
}: {
  course: RlleCourseView;
  onOpenCourse: () => void;
}) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const dimensions = course.progress.dimensions.filter((item) => item.evidenceCount > 0);
  const capabilities = course.canDoMap.filter((item) => item.evidence.length > 0);
  if (dimensions.length === 0 && capabilities.length === 0) return null;

  return (
    <View style={{ gap: spacing.md }} testID="brain-language-evidence">
      <Card elevated style={{ gap: spacing.sm, borderColor: c.aiAccent }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <Badge label={course.languageCode.toUpperCase()} tone="info" />
          <Badge label={course.level.evaluated?.level ?? course.level.declared} />
        </View>
        <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{copy('rlle.ui.brain.evidenceTitle')}</Text>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('rlle.ui.brain.evidenceDetail')}</Text>
        {dimensions.map((dimension) => (
          <View key={dimension.dimension} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={[typography.bodySmall, { color: c.textPrimary, flex: 1 }]}>{copy(`rlle.ui.dimension.${dimension.dimension}`)}</Text>
            <Badge
              label={copy(`rlle.ui.dimension.status.${dimension.status}`)}
              tone={dimension.status === 'emerging' ? 'info' : 'success'}
            />
            <Text style={[typography.caption, { color: c.textMuted }]}>{dimension.evidenceCount}</Text>
          </View>
        ))}
        <Button label={copy('rlle.ui.brain.backCourse')} variant="secondary" onPress={onOpenCourse} />
      </Card>
      {capabilities.length > 0 ? <CanDoList items={capabilities} /> : null}
    </View>
  );
}
