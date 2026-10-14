import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { WorkspacePlanItem, WorkspaceShellKind } from '@second-brain/shared';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { Badge, Card, SegmentedControl } from '../ds/core';

export type WorkspaceShellArea = 'plan' | 'work' | 'sources';

const WORKSPACE_SHELL_AREAS: readonly WorkspaceShellArea[] = ['plan', 'work', 'sources'];

interface WorkspaceShellProps {
  shellKind: WorkspaceShellKind;
  templateLabel: string;
  plan: readonly WorkspacePlanItem[];
  activeArea: WorkspaceShellArea;
  onAreaChange: (area: WorkspaceShellArea) => void;
  desktop: boolean;
  tabletSplit: boolean;
  briefPanel: ReactNode;
  planPanel: ReactNode;
  completionPanel: ReactNode;
  sourcesPanel: ReactNode;
  editorPanel: ReactNode;
  assistantPanel: ReactNode;
}

/**
 * AW-4 composition layer. Every experience receives the same live panels and
 * therefore the same persistence, autosave, sources and assistant behavior.
 * Only their visual hierarchy changes according to the historical template.
 */
export function WorkspaceShell({
  shellKind,
  templateLabel,
  plan,
  activeArea,
  onAreaChange,
  desktop,
  tabletSplit,
  briefPanel,
  planPanel,
  completionPanel,
  sourcesPanel,
  editorPanel,
  assistantPanel,
}: WorkspaceShellProps) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const accent = shellAccent(shellKind, c);
  const familyLabel = t(`workspaceOrchestrator.family.${shellKind}` as TranslationKey);
  const planStack = <View style={{ gap: spacing.md }}>{briefPanel}{planPanel}{completionPanel}</View>;
  const workStack = <View style={{ flex: 1, minWidth: 0, gap: spacing.md }}>
    <ShellPlanPreview shellKind={shellKind} plan={plan} accent={accent} />
    {editorPanel}
    {assistantPanel}
  </View>;

  return <View testID={`workspace-shell-${shellKind}`} style={{ gap: spacing.md }}>
    <Card style={{ borderTopWidth: 4, borderTopColor: accent, gap: spacing.xs }} testID="workspace-shell-identity">
      <Badge label={familyLabel} tone={shellKind === 'general' ? 'primary' : 'neutral'} />
      <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{templateLabel}</Text>
    </Card>

    {!desktop && !tabletSplit ? <SegmentedControl
      testID="workspace-shell-navigation"
      options={WORKSPACE_SHELL_AREAS}
      value={activeArea}
      onChange={onAreaChange}
      labelFor={(area) => shellAreaLabel(shellKind, area, t)}
      wrap
    /> : null}

    {desktop ? renderDesktopShell({
      shellKind,
      spacing: spacing.md,
      briefPanel,
      planPanel,
      completionPanel,
      sourcesPanel,
      editorPanel,
      assistantPanel,
      plan,
      accent,
    }) : tabletSplit ? (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }} testID="workspace-shell-tablet">
        <View style={{ width: 310, gap: spacing.md }}>
          {planStack}
          {sourcesPanel}
        </View>
        {workStack}
      </View>
    ) : (
      <View style={{ gap: spacing.md }} testID="workspace-shell-mobile">
        <View
          accessibilityElementsHidden={activeArea !== 'plan'}
          importantForAccessibility={activeArea === 'plan' ? 'auto' : 'no-hide-descendants'}
          style={{ display: activeArea === 'plan' ? 'flex' : 'none', gap: spacing.md }}
        >
          {planStack}
        </View>
        <View
          accessibilityElementsHidden={activeArea !== 'work'}
          importantForAccessibility={activeArea === 'work' ? 'auto' : 'no-hide-descendants'}
          style={{ display: activeArea === 'work' ? 'flex' : 'none', gap: spacing.md }}
        >
          {workStack}
        </View>
        <View
          accessibilityElementsHidden={activeArea !== 'sources'}
          importantForAccessibility={activeArea === 'sources' ? 'auto' : 'no-hide-descendants'}
          style={{ display: activeArea === 'sources' ? 'flex' : 'none', gap: spacing.md }}
        >
          {sourcesPanel}
        </View>
      </View>
    )}
  </View>;
}

function renderDesktopShell({
  shellKind,
  spacing,
  briefPanel,
  planPanel,
  completionPanel,
  sourcesPanel,
  editorPanel,
  assistantPanel,
  plan,
  accent,
}: Omit<WorkspaceShellProps, 'templateLabel' | 'activeArea' | 'onAreaChange' | 'desktop' | 'tabletSplit'> & {
  spacing: number;
  accent: string;
}) {
  const preview = <ShellPlanPreview shellKind={shellKind} plan={plan} accent={accent} />;

  if (shellKind === 'assignment') {
    return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing }} testID="workspace-shell-desktop-assignment">
      <View style={{ width: 380, gap: spacing }}>{briefPanel}{sourcesPanel}{assistantPanel}</View>
      <View style={{ flex: 1, minWidth: 0, gap: spacing }}>{editorPanel}{planPanel}{completionPanel}</View>
    </View>;
  }

  if (shellKind === 'thesis') {
    return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing }} testID="workspace-shell-desktop-thesis">
      <View style={{ width: 290, gap: spacing }}>{planPanel}{briefPanel}{completionPanel}</View>
      <View style={{ flex: 1, minWidth: 420, gap: spacing }}>{editorPanel}{assistantPanel}</View>
      <View style={{ width: 300, gap: spacing }}>{sourcesPanel}</View>
    </View>;
  }

  if (shellKind === 'dissertation') {
    return <View style={{ gap: spacing }} testID="workspace-shell-desktop-dissertation">
      {preview}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing }}>
        <View style={{ width: 320, gap: spacing }}>{briefPanel}{planPanel}{completionPanel}{sourcesPanel}</View>
        <View style={{ flex: 1, minWidth: 0, gap: spacing }}>{editorPanel}{assistantPanel}</View>
      </View>
    </View>;
  }

  if (shellKind === 'article') {
    return <View style={{ gap: spacing }} testID="workspace-shell-desktop-article">
      {preview}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing }}>
        <View style={{ flex: 1, minWidth: 0, gap: spacing }}>{editorPanel}{assistantPanel}</View>
        <View style={{ width: 340, gap: spacing }}>{briefPanel}{sourcesPanel}{planPanel}{completionPanel}</View>
      </View>
    </View>;
  }

  if (shellKind === 'report') {
    return <View style={{ gap: spacing }} testID="workspace-shell-desktop-report">
      {preview}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing }}>
        <View style={{ width: 300, gap: spacing }}>{briefPanel}{planPanel}</View>
        <View style={{ flex: 1, minWidth: 380, gap: spacing }}>{editorPanel}{assistantPanel}</View>
        <View style={{ width: 300, gap: spacing }}>{sourcesPanel}{completionPanel}</View>
      </View>
    </View>;
  }

  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing }} testID="workspace-shell-desktop-general">
    <View style={{ width: 340, gap: spacing }}>{briefPanel}{sourcesPanel}{planPanel}{completionPanel}</View>
    <View style={{ flex: 1, minWidth: 0, gap: spacing }}>{editorPanel}{assistantPanel}</View>
  </View>;
}

function ShellPlanPreview({
  shellKind,
  plan,
  accent,
}: {
  shellKind: WorkspaceShellKind;
  plan: readonly WorkspacePlanItem[];
  accent: string;
}) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();

  if (shellKind === 'dissertation') {
    const reasoningSections = [
      { key: 'workspaceShell.dissertation.thesis', stepId: 'build-argument' },
      { key: 'workspaceShell.dissertation.antithesis', stepId: 'counterargument' },
      { key: 'research10.synthesis', stepId: 'draft' },
    ] as const;
    const reasoning = reasoningSections.map((section) => ({
      ...section,
      item: plan.find((item) => item.stepId === section.stepId),
    }));
    if (!reasoning.some((section) => Boolean(section.item))) return null;
    return <Card style={{ gap: spacing.sm }} testID="workspace-shell-reasoning-view">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {reasoning.map(({ key, item }) => item ? <View key={key} style={{ flex: 1, minWidth: 150, borderRadius: radius.sm, borderWidth: 1, borderColor: accent, padding: spacing.sm }}>
          <Text style={[typography.overline, { color: accent }]}>{t(key)}</Text>
          <Text numberOfLines={2} style={[typography.bodySmall, { color: c.textPrimary }]}>{item.title}</Text>
        </View> : null)}
      </View>
    </Card>;
  }

  if ((shellKind === 'article' || shellKind === 'report') && plan.length) {
    return <Card style={{ gap: spacing.sm }} testID={`workspace-shell-structure-${shellKind}`}>
      <Text style={[typography.overline, { color: accent }]}>{t('workspace10.structure')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {plan.map((item) => <View key={item.id} style={{ maxWidth: 260, borderRadius: radius.full, backgroundColor: c.surfaceSunken, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
          <Text numberOfLines={1} style={[typography.caption, { color: item.completed ? c.success : c.textSecondary }]}>{item.completed ? '✓ ' : ''}{item.title}</Text>
        </View>)}
      </View>
    </Card>;
  }

  return null;
}

function shellAreaLabel(
  shellKind: WorkspaceShellKind,
  area: WorkspaceShellArea,
  translate: (key: TranslationKey) => string,
): string {
  if (area === 'work') return translate('workspace10.area.work');
  if (area === 'sources') return translate('workspace10.area.sources');
  if (shellKind === 'assignment') return translate('workspace10.assistantQuestion');
  if (shellKind === 'general') return translate('landing12.story.workspace.context');
  return translate('workspace10.area.plan');
}

function shellAccent(
  shellKind: WorkspaceShellKind,
  colors: ReturnType<typeof useTokens>['colors'],
): string {
  switch (shellKind) {
    case 'assignment': return colors.success;
    case 'thesis': return colors.info;
    case 'dissertation': return colors.error;
    case 'article': return colors.aiAccent;
    case 'report': return colors.primary;
    case 'general': return colors.textSecondary;
  }
}
