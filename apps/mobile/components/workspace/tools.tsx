import { useEffect, useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  type WorkspaceProfessorPhase,
  type WorkspaceShellKind,
  type WorkspaceSourceCitation,
  type WorkspaceToolDefinition,
  type WorkspaceToolExecuteRequest,
  type WorkspaceToolExecuteResponse,
  type WorkspaceToolListResponse,
  type WorkspaceToolOperationType,
  type WorkspaceToolProposal,
  type WorkspaceToolRejectRequest,
  type WorkspaceToolSubjectKey,
} from '@second-brain/shared';
import { api, ApiError } from '../../lib/client';
import { localeDirection, useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { createClientRequestId } from '../../lib/request-id';
import { Alert, Badge, Button } from '../ds/core';
import { SourceCitation, SourcePreview, type SourceKind } from '../ds/sources';

export type WorkspaceToolApplicationMode = 'insert' | 'replace';
export interface WorkspaceToolSelectionSnapshot {
  start: number;
  end: number;
  text: string;
}

function apiErrorCode(error: ApiError): string | null {
  if (!error.payload || typeof error.payload !== 'object') return null;
  const code = (error.payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function WorkspaceTools({
  workspaceId,
  shellKind,
  phase,
  selectedText,
  selection,
  sourceCount,
  currentRevision,
  onBeforeRun,
  onApply,
}: {
  workspaceId: string;
  shellKind: WorkspaceShellKind;
  phase: WorkspaceProfessorPhase;
  selectedText: string;
  selection: { start: number; end: number };
  sourceCount: number;
  currentRevision: number;
  onBeforeRun: () => Promise<number | null>;
  onApply: (
    proposal: WorkspaceToolProposal,
    mode: WorkspaceToolApplicationMode,
    selectionAtRun: WorkspaceToolSelectionSnapshot,
  ) => Promise<void>;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const { width } = useResponsive();
  const compact = width < 760;
  const rtl = localeDirection(locale) === 'rtl';
  const [tools, setTools] = useState<WorkspaceToolDefinition[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [runningToolId, setRunningToolId] = useState<string | null>(null);
  const [uncertainRun, setUncertainRun] = useState<{
    toolId: WorkspaceToolDefinition['toolId'];
    request: WorkspaceToolExecuteRequest;
    selection: WorkspaceToolSelectionSnapshot;
  } | null>(null);
  const [proposal, setProposal] = useState<WorkspaceToolProposal | null>(null);
  const [proposalSelection, setProposalSelection] = useState<WorkspaceToolSelectionSnapshot | null>(null);
  const [applying, setApplying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [preview, setPreview] = useState<WorkspaceSourceCitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingTools(true);
    setError(null);
    void api<WorkspaceToolListResponse>(`/workspaces/${workspaceId}/tools`)
      .then((response) => {
        if (cancelled) return;
        // Never present a response computed for a previous Professor phase.
        setTools(response.phase === phase && response.shellKind === shellKind ? response.tools : []);
      })
      .catch((caught) => {
        if (!cancelled) {
          setTools([]);
          setError((caught as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTools(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, shellKind, workspaceId]);

  useEffect(() => {
    setShowMore(false);
    setProposal(null);
    setProposalSelection(null);
    setUncertainRun(null);
    setPreview(null);
    setStale(false);
  }, [phase, workspaceId]);

  useEffect(() => {
    // `onBeforeRun` can autosave and return the new revision before the parent
    // render delivers that same revision prop. Revisions are monotonic, so only
    // a newer parent revision proves that the proposal is stale.
    if (proposal && currentRevision > proposal.baseRevision) setStale(true);
  }, [currentRevision, proposal]);

  const visibleTools = useMemo(
    () => showMore ? tools : tools.slice(0, 3),
    [showMore, tools],
  );

  const run = async (tool: WorkspaceToolDefinition) => {
    if (runningToolId || applying || rejecting) return;
    const selectionAtRun: WorkspaceToolSelectionSnapshot = {
      start: selection.start,
      end: selection.end,
      text: selectedText.trim(),
    };
    if (tool.requiresSelection && !selectionAtRun.text) return;
    if (tool.requiresSources && sourceCount === 0) return;
    setRunningToolId(tool.toolId);
    setError(null);
    setStale(false);
    let executedRequest: WorkspaceToolExecuteRequest | null = null;
    try {
      const expectedRevision = await onBeforeRun();
      if (expectedRevision === null) throw new Error(t('workspace10.save.error'));
      const request = uncertainRun?.toolId === tool.toolId
        && uncertainRun.request.expectedRevision === expectedRevision
        && uncertainRun.selection.start === selectionAtRun.start
        && uncertainRun.selection.end === selectionAtRun.end
        && uncertainRun.selection.text === selectionAtRun.text
        ? uncertainRun.request
        : {
            requestId: createClientRequestId('workspace-tool'),
            expectedRevision,
            ...(selectionAtRun.text ? { selectedText: selectionAtRun.text } : {}),
          } satisfies WorkspaceToolExecuteRequest;
      executedRequest = request;
      const response = await api<WorkspaceToolExecuteResponse>(
        `/workspaces/${workspaceId}/tools/${tool.toolId}`,
        { method: 'POST', body: request, requestId: request.requestId },
      );
      setProposal(response.proposal);
      setUncertainRun(null);
      setProposalSelection(selectionAtRun);
      setPreview(null);
      setStale(response.proposal.baseRevision !== expectedRevision);
    } catch (caught) {
      const apiError = caught as ApiError;
      const executionStillAmbiguous = apiError.status === 0
        || (apiError.status === 409 && apiErrorCode(apiError) === 'workspace_tool_in_progress');
      if (executionStillAmbiguous && executedRequest) {
        setUncertainRun({
          toolId: tool.toolId,
          request: executedRequest,
          selection: selectionAtRun,
        });
      } else {
        setUncertainRun(null);
      }
      setError((caught as Error).message);
    } finally {
      setRunningToolId(null);
    }
  };

  const apply = async () => {
    if (!proposal || !proposalSelection || proposal.status !== 'ready' || applying || rejecting || stale) return;
    setApplying(true);
    setError(null);
    try {
      const definition = tools.find((tool) => tool.toolId === proposal.toolId);
      const mode: WorkspaceToolApplicationMode = definition?.operationType === 'TRANSFORM'
        && definition.requiresSelection
        ? 'replace'
        : 'insert';
      await onApply(proposal, mode, proposalSelection);
      setProposal(null);
      setProposalSelection(null);
      setPreview(null);
    } catch (caught) {
      const apiError = caught as ApiError;
      if (apiError.status === 409) setStale(true);
      setError((caught as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const reject = async () => {
    if (!proposal || applying || rejecting) return;
    setRejecting(true);
    setError(null);
    try {
      const request: WorkspaceToolRejectRequest = { requestId: proposal.requestId };
      await api(`/workspaces/${workspaceId}/tools/${proposal.toolId}/reject`, {
        method: 'POST',
        body: request,
        requestId: request.requestId,
      });
      setProposal(null);
      setProposalSelection(null);
      setPreview(null);
      setStale(false);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setRejecting(false);
    }
  };

  return <View
    testID="workspace-tools"
    style={{ gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: spacing.md }}
  >
    <View style={{ gap: spacing.xs }}>
      <Text
        accessibilityRole="header"
        style={[typography.label, { color: c.textPrimary, textAlign: rtl ? 'right' : 'left' }]}
      >
        {t('workspace10.assistant')} · {t('learn.section.modes')}
      </Text>
      <Text style={[typography.caption, { color: c.textMuted, textAlign: rtl ? 'right' : 'left' }]}>
        {t('workspace10.assistantDetail')}
      </Text>
    </View>

    <View style={{
      flexDirection: compact ? 'column' : rtl ? 'row-reverse' : 'row',
      flexWrap: compact ? 'nowrap' : 'wrap',
      gap: spacing.xs,
      alignItems: compact ? 'stretch' : 'center',
    }}>
      {visibleTools.map((tool) => {
        const missingSelection = tool.requiresSelection && !selectedText.trim();
        const missingSource = tool.requiresSources && sourceCount === 0;
        const label = workspaceToolLabel(tool, t);
        const requirement = missingSelection
          ? t('workspace10.selection')
          : missingSource
            ? t('workspace10.sourcesEmpty')
            : null;
        return <Button
          key={tool.toolId}
          testID={`workspace-tool-${tool.toolId}`}
          size="sm"
          variant="secondary"
          fullWidth={compact}
          label={label}
          accessibilityLabel={requirement ? `${label} · ${requirement}` : label}
          disabled={Boolean(runningToolId || applying || rejecting || requirement)}
          loading={runningToolId === tool.toolId}
          onPress={() => void run(tool)}
        />;
      })}
      {tools.length > 3 ? <Button
        testID="workspace-tools-more"
        size="sm"
        variant="ghost"
        fullWidth={compact}
        label={t(showMore ? 'library7.action.less' : 'library7.action.more')}
        onPress={() => setShowMore((current) => !current)}
      /> : null}
    </View>

    {!loadingTools && tools.length === 0 && !error ? <Text style={[typography.caption, { color: c.textMuted }]}>
      {t('workspace10.nextSection', { section: t(`workspaceProfessor.phase.${phase}` as TranslationKey) })}
    </Text> : null}

    {proposal ? <View
      testID="workspace-tool-proposal"
      style={{ gap: spacing.sm, backgroundColor: c.surfaceSunken, padding: spacing.sm, borderRadius: 10 }}
    >
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        <Badge tone="ai" label={t('session.results')} />
        {proposal.provenance.userContent ? <Badge tone="neutral" label={t('workspace10.area.work')} /> : null}
        {proposal.provenance.sourceGrounded ? <Badge tone="info" label={t('workspace10.sources')} /> : null}
        {proposal.provenance.modelSuggestion ? <Badge tone="primary" label={t('workspace10.assist.suggest')} /> : null}
      </View>
      <Text selectable style={[typography.bodySmall, { color: c.textPrimary, textAlign: rtl ? 'right' : 'left' }]}>
        {proposal.content}
      </Text>
      {proposal.status === 'source-unavailable' ? <Alert
        tone="warning"
        title={t('research10.noSources')}
        detail={t('research10.noSourcesDetail')}
      /> : null}
      {proposal.citations.length ? <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {proposal.citations.map((citation) => <SourceCitation
          key={`${proposal.id}:${citation.citationLabel}`}
          title={`${citation.citationLabel} · ${citation.title}`}
          kind={citationKind(citation)}
          onPress={() => setPreview(citation)}
        />)}
      </View> : null}
      {stale ? <View testID="workspace-tool-stale">
        <Alert
          tone="warning"
          title={t('state.stale')}
          detail={t('error.conflict')}
        />
      </View> : null}
      <View style={{
        flexDirection: compact ? 'column' : rtl ? 'row-reverse' : 'row',
        gap: spacing.xs,
        alignItems: compact ? 'stretch' : 'center',
      }}>
        <Button
          testID="workspace-tool-apply"
          size="sm"
          variant="ai"
          fullWidth={compact}
          label={t('globalPath.insertProposal')}
          loading={applying}
          disabled={proposal.status !== 'ready' || stale || rejecting}
          onPress={() => void apply()}
        />
        <Button
          testID="workspace-tool-reject"
          size="sm"
          variant="ghost"
          fullWidth={compact}
          label={t('app.dismiss')}
          loading={rejecting}
          disabled={applying}
          onPress={() => void reject()}
        />
      </View>
    </View> : null}

    {preview ? <SourcePreview
      title={`${preview.citationLabel} · ${preview.title}`}
      snippet={preview.snippet}
      location={preview.page ? `${preview.citationLabel} · p. ${preview.page}` : preview.citationLabel}
      kind={citationKind(preview)}
      onOpen={citationCanOpen(preview) ? () => void openCitation(preview, router) : undefined}
      onClose={() => setPreview(null)}
    /> : null}
    {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
  </View>;
}

const OPERATION_LABELS: Record<WorkspaceToolOperationType, readonly TranslationKey[]> = {
  ANALYZE: ['landing12.story.workspace.analysis'],
  CHECK: ['workspaceProfessor.phase.VERIFICATION'],
  SUGGEST: ['workspace10.assist.suggest'],
  TRANSFORM: ['workspace10.assist.rephrase'],
};

const SUBJECT_LABELS: Record<WorkspaceToolSubjectKey, readonly TranslationKey[]> = {
  answer: ['rlle.ui.training.answer'],
  error: ['brain8.history.kind.error'],
  instructions: ['workspace10.assistantQuestion'],
  clarity: ['writing.d.clarity'],
  problem: ['research10.question'],
  plan: ['workspace10.plan'],
  section: ['workspace10.plan.new'],
  sourceSupport: ['workspace10.sources', 'workspaceProfessor.phase.VERIFICATION'],
  sources: ['workspace10.sources'],
  thesis: ['workspaceShell.dissertation.thesis'],
  counterargument: ['workspace10.assist.challenge'],
  argumentLogic: ['writing.d.logic'],
  transition: ['workspace10.continue', 'writing.d.logic'],
  dialectic: ['workspaceShell.dissertation.thesis', 'workspaceShell.dissertation.antithesis'],
  scientificStructure: ['workspace10.template.article', 'workspace10.structure'],
  abstract: ['workspace10.template.article', 'workspace10.assist.structure'],
  methodResults: ['coachp.method', 'session.results'],
  discussionResults: ['tutor.discussion', 'session.results'],
  unsupportedClaims: ['workspace10.sources', 'brain8.history.kind.error'],
  objectivesResults: ['workspace10.field.objective', 'session.results'],
  observationsRecommendations: ['session.results', 'org.recommendations'],
  missingSections: ['workspace10.plan.new', 'brain8.history.kind.error'],
  overallCoherence: ['workspace10.assist.check-coherence'],
  structure: ['workspace10.structure'],
};

function workspaceToolLabel(
  tool: WorkspaceToolDefinition,
  translate: (key: TranslationKey) => string,
): string {
  // labelKey stays a stable registry/audit identifier. The visible copy is
  // composed exclusively from complete, reviewed 34-locale catalog entries.
  return [...OPERATION_LABELS[tool.operationType], ...SUBJECT_LABELS[tool.subjectKey]]
    .map(translate)
    .join(' · ');
}

function citationKind(citation: WorkspaceSourceCitation): SourceKind {
  if (citation.sourceType === 'brain') return 'brain';
  if (citation.sourceType === 'web') return 'web';
  if (citation.sourceType === 'external' || citation.sourceType === 'research') return 'external';
  return 'document';
}

function citationCanOpen(citation: WorkspaceSourceCitation): boolean {
  return Boolean(
    citation.documentId
    || citation.sourceType === 'brain'
    || (citation.url && /^https:\/\//i.test(citation.url)),
  );
}

async function openCitation(citation: WorkspaceSourceCitation, router: ReturnType<typeof useRouter>) {
  if (citation.documentId) {
    router.push(`/library/${citation.documentId}`);
    return;
  }
  if (citation.sourceType === 'brain') {
    router.push('/brain');
    return;
  }
  if (citation.url && /^https:\/\//i.test(citation.url)) await Linking.openURL(citation.url);
}
