import type {
  WorkspaceBrief,
  WorkspaceCompletionCheck,
  WorkspaceDraft,
  WorkspacePlanItem,
  WorkspaceProfessorPhase,
  WorkspaceProjectStatus,
  WorkspaceSourceCitation,
  WorkspaceSourceReference,
  WorkspaceSourceState,
  WorkspaceTemplate,
} from './workspace-persistence';
import type { WorkspaceShellKind } from './workspace-orchestrator';

export const WORKSPACE_FINAL_SNAPSHOT_FORMAT_VERSION = 1 as const;
export const WORKSPACE_COMPLETION_STATE_VERSION = 1 as const;

export const WORKSPACE_EXPORT_FORMATS = ['pdf', 'markdown'] as const;
export type WorkspaceExportFormat = (typeof WORKSPACE_EXPORT_FORMATS)[number];

/** DOCX deliberately remains outside AW-8 V1 unless an existing renderer is found. */
export const WORKSPACE_DEFERRED_EXPORT_FORMATS = ['docx'] as const;

export type WorkspaceFinalizationPhase = Extract<
  WorkspaceProfessorPhase,
  'FINALIZATION' | 'DECONSTRUCTION'
>;

/**
 * Immutable-by-contract representation of one completed logical version.
 * The API appends snapshots to the existing Workspace progress JSON; it never
 * mutates an older entry when the learner resumes editing.
 */
export interface WorkspaceFinalSnapshot {
  readonly id: string;
  readonly version: number;
  readonly formatVersion: typeof WORKSPACE_FINAL_SNAPSHOT_FORMAT_VERSION;
  readonly workspaceId: string;
  readonly template: WorkspaceTemplate;
  readonly shell: WorkspaceShellKind;
  readonly title: string;
  readonly brief: WorkspaceBrief;
  readonly plan: readonly WorkspacePlanItem[];
  readonly draft: WorkspaceDraft;
  readonly sources: readonly WorkspaceSourceReference[];
  readonly sourceStates: readonly WorkspaceSourceState[];
  readonly citations: readonly WorkspaceSourceCitation[];
  readonly checks: readonly WorkspaceCompletionCheck[];
  readonly phase: WorkspaceFinalizationPhase;
  readonly revision: number;
  readonly createdAt: string;
}

export const WORKSPACE_COMPLETION_ACTIONS = [
  'finalize',
  'export',
  'archive',
  'restore',
] as const;
export type WorkspaceCompletionAction = (typeof WORKSPACE_COMPLETION_ACTIONS)[number];

export type WorkspaceCompletionOperationStatus = 'pending' | 'completed' | 'failed';

export interface WorkspaceCompletionOperation {
  requestId: string;
  requestFingerprint: string;
  action: WorkspaceCompletionAction;
  status: WorkspaceCompletionOperationStatus;
  createdAt: string;
  updatedAt: string;
  expectedRevision: number;
  resultingRevision?: number;
  snapshotId?: string;
  exportFormat?: WorkspaceExportFormat;
  failureCode?: 'conflict' | 'gate' | 'render' | 'persistence';
}

/** Compact idempotency receipt retained beyond the visible operation journal. */
export interface WorkspaceCompletionRequestReceipt {
  requestFingerprint: string;
  action: WorkspaceCompletionAction;
  status: WorkspaceCompletionOperationStatus;
  updatedAt: string;
  resultingRevision?: number;
  snapshotId?: string;
  exportFormat?: WorkspaceExportFormat;
}

/** Stored additively in the existing progress.workflow JSON. */
export interface WorkspaceCompletionState {
  version: typeof WORKSPACE_COMPLETION_STATE_VERSION;
  snapshots: WorkspaceFinalSnapshot[];
  operations: WorkspaceCompletionOperation[];
  /** Keys are server-side hashes of request ids, never credentials or tokens. */
  requestLedger: Record<string, WorkspaceCompletionRequestReceipt>;
}

export const WORKSPACE_FINALIZATION_BLOCKER_CODES = [
  'invalid-phase',
  'empty-draft',
  'required-check-failed',
  'source-unavailable',
] as const;
export type WorkspaceFinalizationBlockerCode = (typeof WORKSPACE_FINALIZATION_BLOCKER_CODES)[number];

export interface WorkspaceFinalizationBlocker {
  code: WorkspaceFinalizationBlockerCode;
  checkId?: WorkspaceCompletionCheck['id'];
  sourceId?: string;
}

export interface WorkspaceCompletionStateResponse {
  workspaceId: string;
  status: WorkspaceProjectStatus;
  revision: number;
  phase: WorkspaceProfessorPhase;
  checks: WorkspaceCompletionCheck[];
  ready: boolean;
  blockers: WorkspaceFinalizationBlocker[];
  snapshots: WorkspaceFinalSnapshot[];
  latestSnapshot: WorkspaceFinalSnapshot | null;
}

export interface WorkspaceFinalizeRequest {
  /** Stable idempotency key for one logical finalization. */
  requestId: string;
  expectedRevision: number;
  /** Optional dirty draft; the server must persist it before snapshotting. */
  draft?: Omit<WorkspaceDraft, 'revision' | 'updatedAt'>;
}

export interface WorkspaceFinalizeResponse {
  snapshot: WorkspaceFinalSnapshot;
  revision: number;
  status: WorkspaceProjectStatus;
  checks: WorkspaceCompletionCheck[];
}

export interface WorkspaceExportRequest {
  /** Stable idempotency key for one logical export. */
  requestId: string;
  snapshotId: string;
  format: WorkspaceExportFormat;
  /** Used only for presentation direction/labels; never for authorization. */
  locale?: string;
}

export interface WorkspaceExportResponse {
  snapshotId: string;
  format: WorkspaceExportFormat;
  fileName: string;
  mimeType: 'application/pdf' | 'text/markdown; charset=utf-8';
  /** UTF-8 Markdown when format is markdown. */
  content?: string;
  /** Safe print source when format is PDF; scripts are never emitted. */
  html?: string;
}

export interface WorkspaceArchiveRequest {
  requestId: string;
  expectedRevision: number;
}

export interface WorkspaceArchiveResponse {
  archived: true;
  status: Extract<WorkspaceProjectStatus, 'archived'>;
  revision: number;
  snapshot: WorkspaceFinalSnapshot;
}

export interface WorkspaceRestoreRequest {
  requestId: string;
  expectedRevision: number;
}

export interface WorkspaceRestoreResponse {
  restored: true;
  status: Extract<WorkspaceProjectStatus, 'active'>;
  revision: number;
  latestSnapshot: WorkspaceFinalSnapshot | null;
}

export interface CreateWorkspaceFinalSnapshotInput {
  snapshotId: string;
  logicalVersion: number;
  workspaceId: string;
  template: WorkspaceTemplate;
  shell: WorkspaceShellKind;
  title: string;
  brief: WorkspaceBrief;
  plan: readonly WorkspacePlanItem[];
  draft: WorkspaceDraft;
  sources: readonly WorkspaceSourceReference[];
  sourceStates: readonly WorkspaceSourceState[];
  citations: readonly WorkspaceSourceCitation[];
  checks: readonly WorkspaceCompletionCheck[];
  phase: WorkspaceProfessorPhase;
  revision: number;
  createdAt: string;
}

export class WorkspaceCompletionContractError extends Error {
  constructor(
    public readonly code: 'invalid-version' | 'invalid-phase' | 'revision-mismatch' | 'finalization-blocked',
    message: string,
  ) {
    super(message);
    this.name = 'WorkspaceCompletionContractError';
  }
}

export function initialWorkspaceCompletionState(): WorkspaceCompletionState {
  return { version: WORKSPACE_COMPLETION_STATE_VERSION, snapshots: [], operations: [], requestLedger: {} };
}

export function workspaceFinalizationBlockers(input: {
  phase: WorkspaceProfessorPhase;
  draftContent: string;
  checks: readonly WorkspaceCompletionCheck[];
  sourceStates?: readonly WorkspaceSourceState[];
}): WorkspaceFinalizationBlocker[] {
  const blockers: WorkspaceFinalizationBlocker[] = [];
  if (input.phase !== 'FINALIZATION' && input.phase !== 'DECONSTRUCTION') {
    blockers.push({ code: 'invalid-phase' });
  }
  if (!input.draftContent.trim()) blockers.push({ code: 'empty-draft' });
  for (const check of input.checks) {
    if (check.required && !check.passed) {
      blockers.push({ code: 'required-check-failed', checkId: check.id });
    }
  }
  const sourcesRequired = input.checks.some((check) => check.id === 'sources' && check.required);
  if (sourcesRequired) {
    for (const source of input.sourceStates ?? []) {
      if (source.availability === 'unavailable') {
        blockers.push({ code: 'source-unavailable', sourceId: source.id });
      }
    }
  }
  return blockers;
}

export function createWorkspaceFinalSnapshot(
  input: CreateWorkspaceFinalSnapshotInput,
): WorkspaceFinalSnapshot {
  if (!Number.isSafeInteger(input.logicalVersion) || input.logicalVersion < 1) {
    throw new WorkspaceCompletionContractError('invalid-version', 'A final snapshot version must be a positive integer.');
  }
  if (input.phase !== 'FINALIZATION' && input.phase !== 'DECONSTRUCTION') {
    throw new WorkspaceCompletionContractError('invalid-phase', 'A final snapshot requires the finalization cycle.');
  }
  if (input.draft.revision !== input.revision) {
    throw new WorkspaceCompletionContractError('revision-mismatch', 'The saved draft revision does not match the final revision.');
  }
  if (workspaceFinalizationBlockers({
    phase: input.phase,
    draftContent: input.draft.content,
    checks: input.checks,
    sourceStates: input.sourceStates,
  }).length > 0) {
    throw new WorkspaceCompletionContractError('finalization-blocked', 'Required finalization controls are not satisfied.');
  }

  return {
    id: input.snapshotId,
    version: input.logicalVersion,
    formatVersion: WORKSPACE_FINAL_SNAPSHOT_FORMAT_VERSION,
    workspaceId: input.workspaceId,
    template: input.template,
    shell: input.shell,
    title: input.title,
    brief: cloneBrief(input.brief),
    plan: input.plan.map(clonePlanItem),
    draft: { ...input.draft },
    sources: input.sources.map(cloneSourceReference),
    sourceStates: input.sourceStates.map(cloneSourceState),
    citations: input.citations.map(cloneCitation),
    checks: input.checks.map((check) => ({ ...check })),
    phase: input.phase,
    revision: input.revision,
    createdAt: input.createdAt,
  };
}

export interface WorkspaceExportLabels {
  referencesHeading?: string;
  unavailableSourcesHeading?: string;
  page?: string;
  retrievedAt?: string;
}

export interface WorkspaceExportRenderOptions {
  locale?: string;
  direction?: 'ltr' | 'rtl';
  labels?: WorkspaceExportLabels;
}

/**
 * Produces portable UTF-8 Markdown without raw HTML or executable URL schemes.
 * It never invents bibliography fields and excludes all internal ids/prompts.
 */
export function renderWorkspaceMarkdown(
  snapshot: WorkspaceFinalSnapshot,
  options: WorkspaceExportRenderOptions = {},
): string {
  const title = escapeMarkdownInline(snapshot.title.trim() || '—');
  const content = snapshot.draft.format === 'markdown'
    ? sanitizeWorkspaceMarkdown(snapshot.draft.content)
    : escapePlainTextForMarkdown(snapshot.draft.content);
  const sections = [`# ${title}`, content.trim()];
  const citations = renderMarkdownCitations(snapshot.citations, options.labels);
  if (citations) sections.push(citations);
  const unavailable = renderMarkdownUnavailableSources(snapshot.sourceStates, options.labels);
  if (unavailable) sections.push(unavailable);
  return `${sections.filter(Boolean).join('\n\n')}\n`;
}

/** Full, dependency-free print source. All learner/source content is escaped. */
export function renderWorkspaceExportHtml(
  snapshot: WorkspaceFinalSnapshot,
  options: WorkspaceExportRenderOptions = {},
): string {
  const direction = options.direction ?? inferWorkspaceTextDirection(`${snapshot.title}\n${snapshot.draft.content}`);
  const locale = safeLocale(options.locale);
  const title = escapeHtml(snapshot.title.trim() || '—');
  const body = renderSafeDocumentBody(snapshot.draft.content, snapshot.draft.format);
  const citations = renderHtmlCitations(snapshot.citations, options.labels);
  const unavailable = renderHtmlUnavailableSources(snapshot.sourceStates, options.labels);
  return [
    '<!doctype html>',
    `<html lang="${locale}" dir="${direction}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '<style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55;margin:40px;color:#17171c}main{max-width:820px;margin:auto}h1,h2,h3{line-height:1.25}blockquote{border-inline-start:3px solid #777;margin-inline:0;padding-inline-start:1em;color:#444}li{margin:.25em 0}.references{margin-top:2.5em;padding-top:1em;border-top:1px solid #bbb}.citation-snippet{white-space:pre-wrap;color:#444}a{color:inherit;overflow-wrap:anywhere}@media print{body{margin:18mm}.page-break{break-before:page}}</style>',
    '</head>',
    '<body>',
    '<main>',
    `<h1>${title}</h1>`,
    body,
    citations,
    unavailable,
    '</main>',
    '</body>',
    '</html>',
  ].filter(Boolean).join('');
}

export function workspaceExportFileName(
  title: string,
  format: WorkspaceExportFormat,
  version?: number,
): string {
  const safeTitle = title
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96) || 'workspace';
  const versionSuffix = version && version > 1 ? `-v${Math.trunc(version)}` : '';
  return `${safeTitle}${versionSuffix}.${format === 'pdf' ? 'pdf' : 'md'}`;
}

export function inferWorkspaceTextDirection(value: string): 'ltr' | 'rtl' {
  const rtl = (value.match(/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/g) ?? []).length;
  const ltr = (value.match(/[A-Za-z\u00C0-\u02AF\u0370-\u052F]/g) ?? []).length;
  return rtl > ltr ? 'rtl' : 'ltr';
}

export function sanitizeWorkspaceMarkdown(value: string): string {
  return neutralizeDangerousMarkdownLinks(stripUnsafeControls(value))
    // Keep the export portable Markdown while preventing raw HTML blocks,
    // including multiline tags that a CommonMark renderer could execute.
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapePlainTextForMarkdown(value: string): string {
  return stripUnsafeControls(value)
    .split('\n')
    .map((line) => escapeMarkdownInline(line))
    .join('\n');
}

function renderMarkdownCitations(
  citations: readonly WorkspaceSourceCitation[],
  labels?: WorkspaceExportLabels,
): string {
  if (citations.length === 0) return '';
  const heading = labels?.referencesHeading?.trim();
  const lines = heading ? [`## ${escapeMarkdownInline(heading)}`, ''] : ['---', ''];
  citations.forEach((citation, index) => {
    const title = escapeMarkdownInline(citation.title);
    const url = safeHttpUrl(citation.url);
    const main = url ? `[${title}](${url})` : title;
    const details: string[] = [];
    if (typeof citation.page === 'number') {
      details.push(`${labels?.page ? `${escapeMarkdownInline(labels.page)} ` : ''}${citation.page}`);
    }
    if (citation.retrievedAt) {
      details.push(`${labels?.retrievedAt ? `${escapeMarkdownInline(labels.retrievedAt)} ` : ''}${escapeMarkdownInline(citation.retrievedAt)}`);
    }
    lines.push(`${index + 1}. ${main}${details.length ? ` — ${details.join(' — ')}` : ''}`);
    if (citation.snippet.trim()) {
      lines.push(`   > ${escapeMarkdownInline(citation.snippet).replace(/\n/g, '\n   > ')}`);
    }
  });
  return lines.join('\n');
}

function renderMarkdownUnavailableSources(
  sources: readonly WorkspaceSourceState[],
  labels?: WorkspaceExportLabels,
): string {
  const unavailable = sources.filter((source) => source.availability === 'unavailable');
  if (unavailable.length === 0) return '';
  const heading = labels?.unavailableSourcesHeading?.trim();
  return [
    heading ? `## ${escapeMarkdownInline(heading)}` : '---',
    '',
    ...unavailable.map((source) => {
      const title = exportableUnavailableSourceTitle(source);
      return title ? `- ⚠ ${escapeMarkdownInline(title)}` : '- ⚠';
    }),
  ].join('\n');
}

function renderSafeDocumentBody(content: string, format: WorkspaceDraft['format']): string {
  const normalized = neutralizeDangerousMarkdownLinks(stripUnsafeControls(content));
  const lines = normalized.split('\n');
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (format === 'markdown') {
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        closeList();
        const level = heading[1]!.length + 1;
        html.push(`<h${level}>${escapeHtml(heading[2]!)}</h${level}>`);
        continue;
      }
      const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
      const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
      if (unordered || ordered) {
        const nextList = unordered ? 'ul' : 'ol';
        if (list !== nextList) {
          closeList();
          list = nextList;
          html.push(`<${list}>`);
        }
        html.push(`<li>${escapeHtml((unordered ?? ordered)![1]!)}</li>`);
        continue;
      }
      const quote = /^\s*>\s?(.+)$/.exec(line);
      if (quote) {
        closeList();
        html.push(`<blockquote>${escapeHtml(quote[1]!)}</blockquote>`);
        continue;
      }
    }
    closeList();
    html.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  return html.join('');
}

function renderHtmlCitations(
  citations: readonly WorkspaceSourceCitation[],
  labels?: WorkspaceExportLabels,
): string {
  if (citations.length === 0) return '';
  const heading = labels?.referencesHeading?.trim();
  const items = citations.map((citation) => {
    const url = safeHttpUrl(citation.url);
    const title = escapeHtml(citation.title);
    const linkedTitle = url
      ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${title}</a>`
      : title;
    const details: string[] = [];
    if (typeof citation.page === 'number') {
      details.push(`${labels?.page ? `${escapeHtml(labels.page)} ` : ''}${citation.page}`);
    }
    if (citation.retrievedAt) {
      details.push(`${labels?.retrievedAt ? `${escapeHtml(labels.retrievedAt)} ` : ''}${escapeHtml(citation.retrievedAt)}`);
    }
    const snippet = citation.snippet.trim()
      ? `<div class="citation-snippet">${escapeHtml(citation.snippet)}</div>`
      : '';
    return `<li>${linkedTitle}${details.length ? ` — ${details.join(' — ')}` : ''}${snippet}</li>`;
  }).join('');
  return `<section class="references">${heading ? `<h2>${escapeHtml(heading)}</h2>` : ''}<ol>${items}</ol></section>`;
}

function renderHtmlUnavailableSources(
  sources: readonly WorkspaceSourceState[],
  labels?: WorkspaceExportLabels,
): string {
  const unavailable = sources.filter((source) => source.availability === 'unavailable');
  if (unavailable.length === 0) return '';
  const heading = labels?.unavailableSourcesHeading?.trim();
  return `<section class="references">${heading ? `<h2>${escapeHtml(heading)}</h2>` : ''}<ul>${unavailable.map((source) => {
    const title = exportableUnavailableSourceTitle(source);
    return `<li>⚠${title ? ` ${escapeHtml(title)}` : ''}</li>`;
  }).join('')}</ul></section>`;
}

function exportableUnavailableSourceTitle(source: WorkspaceSourceState): string | null {
  const title = source.title.trim();
  return title && title !== source.id ? title : null;
}

function cloneBrief(brief: WorkspaceBrief): WorkspaceBrief {
  const fields: WorkspaceBrief['fields'] = {};
  for (const [key, value] of Object.entries(brief.fields)) {
    if (typeof value === 'string') fields[key as keyof WorkspaceBrief['fields']] = value;
  }
  return { version: 1, fields };
}

function clonePlanItem(item: WorkspacePlanItem): WorkspacePlanItem {
  return {
    id: item.id,
    title: item.title,
    order: item.order,
    completed: item.completed,
    ...(item.stepId ? { stepId: item.stepId } : {}),
  };
}

function cloneSourceReference(source: WorkspaceSourceReference): WorkspaceSourceReference {
  return {
    kind: source.kind,
    id: source.id,
    ...(source.title ? { title: source.title } : {}),
  };
}

function cloneSourceState(source: WorkspaceSourceState): WorkspaceSourceState {
  return {
    kind: source.kind,
    id: source.id,
    title: source.title,
    availability: source.availability,
    ...(source.reason ? { reason: source.reason } : {}),
  };
}

function cloneCitation(citation: WorkspaceSourceCitation): WorkspaceSourceCitation {
  return {
    sourceType: citation.sourceType,
    sourceId: citation.sourceId,
    ...(citation.documentId ? { documentId: citation.documentId } : {}),
    ...(citation.conceptId ? { conceptId: citation.conceptId } : {}),
    title: citation.title,
    ...(typeof citation.page === 'number' ? { page: citation.page } : {}),
    ...(typeof citation.chunkIndex === 'number' ? { chunkIndex: citation.chunkIndex } : {}),
    ...(citation.url ? { url: citation.url } : {}),
    ...(citation.retrievedAt ? { retrievedAt: citation.retrievedAt } : {}),
    snippet: citation.snippet,
    citationLabel: citation.citationLabel,
    ...(citation.relevance !== undefined ? { relevance: citation.relevance } : {}),
  };
}

function stripUnsafeControls(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function neutralizeDangerousMarkdownLinks(value: string): string {
  const balancedLinks = neutralizeDangerousInlineMarkdownLinks(value);
  const safeOpeners = breakDangerousInlineLinkOpeners(balancedLinks);
  const referenceDefinitions = neutralizeDangerousReferenceDefinitions(safeOpeners);
  return neutralizeDangerousReferenceDelimiters(referenceDefinitions);
}

/**
 * Defense in depth for valid CommonMark constructs our small balanced scanner
 * does not need to fully render (for example unusual quoted titles). Breaking
 * the opening delimiter guarantees the remaining text cannot become a link.
 */
function breakDangerousInlineLinkOpeners(value: string): string {
  let sanitized = '';
  let copiedUntil = 0;
  for (let cursor = 0; cursor < value.length - 1; cursor += 1) {
    if (value[cursor] !== ']' || value[cursor + 1] !== '(') continue;
    if (!dangerousMarkdownDestination(value.slice(cursor + 2))) continue;
    sanitized += `${value.slice(copiedUntil, cursor + 1)}\\(`;
    copiedUntil = cursor + 2;
    cursor += 1;
  }
  return sanitized + value.slice(copiedUntil);
}

function neutralizeDangerousInlineMarkdownLinks(value: string): string {
  let sanitized = '';
  let copiedUntil = 0;

  for (let closingBracket = 0; closingBracket < value.length - 1; closingBracket += 1) {
    if (value[closingBracket] !== ']' || value[closingBracket + 1] !== '(') continue;

    let depth = 1;
    let escaped = false;
    let quotedTitle: '"' | "'" | null = null;
    let angleDestination = false;
    let closingParenthesis = -1;

    for (let cursor = closingBracket + 2; cursor < value.length; cursor += 1) {
      const character = value[cursor];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (quotedTitle) {
        if (character === quotedTitle) quotedTitle = null;
        continue;
      }
      if (angleDestination) {
        if (character === '>') angleDestination = false;
        continue;
      }
      if (
        (character === '"' || character === "'")
        && (cursor === closingBracket + 2 || /\s/.test(value[cursor - 1]!))
      ) {
        quotedTitle = character;
        continue;
      }
      if (character === '<') {
        angleDestination = true;
        continue;
      }
      if (character === '(') depth += 1;
      if (character === ')') {
        depth -= 1;
        if (depth === 0) {
          closingParenthesis = cursor;
          break;
        }
      }
    }

    if (closingParenthesis < 0) continue;

    const destination = value.slice(closingBracket + 2, closingParenthesis);
    if (dangerousMarkdownDestination(destination)) {
      sanitized += value.slice(copiedUntil, closingBracket + 1);
      copiedUntil = closingParenthesis + 1;
    }
    closingBracket = closingParenthesis;
  }

  return sanitized + value.slice(copiedUntil);
}

function neutralizeDangerousReferenceDefinitions(value: string): string {
  const lines = value.split('\n');
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    const definitionEnd = markdownReferenceDefinitionEnd(line);
    if (definitionEnd < 0) continue;

    let destination = line.slice(definitionEnd).trimStart();
    let destinationLine = lineIndex;
    if (!destination && lineIndex + 1 < lines.length && /^\s*\S/.test(lines[lineIndex + 1]!)) {
      destinationLine = lineIndex + 1;
      destination = lines[destinationLine]!.trim();
    }
    if (!dangerousMarkdownDestination(destination)) continue;

    // Retain the human-readable label but remove the executable destination.
    // A continuation line must also be cleared or CommonMark would still bind it.
    lines[lineIndex] = line.slice(0, definitionEnd);
    if (destinationLine !== lineIndex) lines[destinationLine] = '';
  }
  return lines.join('\n');
}

/**
 * Reference labels may span lines in CommonMark. The final `]:` delimiter is
 * still local to one line, so validate every such delimiter independently of
 * label layout and strip only an executable destination.
 */
function neutralizeDangerousReferenceDelimiters(value: string): string {
  const lines = value.split('\n');
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    let delimiter = line.indexOf(']:');
    while (delimiter >= 0) {
      let destination = line.slice(delimiter + 2).trimStart();
      let destinationLine = lineIndex;
      if (!destination && lineIndex + 1 < lines.length && /^\s*\S/.test(lines[lineIndex + 1]!)) {
        destinationLine = lineIndex + 1;
        destination = lines[destinationLine]!.trim();
      }
      if (dangerousMarkdownDestination(destination)) {
        lines[lineIndex] = line.slice(0, delimiter + 2);
        if (destinationLine !== lineIndex) lines[destinationLine] = '';
        break;
      }
      delimiter = line.indexOf(']:', delimiter + 2);
    }
  }
  return lines.join('\n');
}

function markdownReferenceDefinitionEnd(line: string): number {
  let cursor = 0;
  while (cursor < 3 && line[cursor] === ' ') cursor += 1;
  if (line[cursor] !== '[') return -1;

  let escaped = false;
  for (cursor += 1; cursor < line.length; cursor += 1) {
    const character = line[cursor];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === ']' && line[cursor + 1] === ':') return cursor + 2;
  }
  return -1;
}

function dangerousMarkdownDestination(value: string): boolean {
  let normalized = value.trim().replace(/^</, '').replace(/>.*$/, '');
  normalized = normalized
    // CommonMark removes backslashes before ASCII punctuation when resolving
    // destinations. Normalize those escapes before checking the URL scheme.
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, '$1')
    .replace(/&#x([0-9a-f]+);?/gi, (match, hex) => safeMarkdownCodePoint(match, hex, 16))
    .replace(/&#([0-9]+);?/g, (match, decimal) => safeMarkdownCodePoint(match, decimal, 10))
    .replace(/&colon;/gi, ':')
    .replace(/&(tab|newline);/gi, '');
  for (let pass = 0; pass < 2; pass += 1) {
    const decoded = normalized.replace(/%([0-9a-f]{2})/gi, (match, hex) => (
      String.fromCharCode(Number.parseInt(hex, 16))
    ));
    if (decoded === normalized) break;
    normalized = decoded;
  }
  normalized = normalized.replace(/[\u0000-\u0020\u007F]+/g, '');
  return /^(?:javascript|vbscript|data):/i.test(normalized);
}

function safeMarkdownCodePoint(fallback: string, value: string, radix: number): string {
  const codePoint = Number.parseInt(value, radix);
  return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
    ? String.fromCodePoint(codePoint)
    : fallback;
}

function escapeMarkdownInline(value: string): string {
  return stripUnsafeControls(value).replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
}

function escapeHtml(value: string): string {
  return stripUnsafeControls(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHttpUrl(value?: string): string | null {
  const normalized = value?.trim();
  if (!normalized || !/^https?:\/\//i.test(normalized)) return null;
  return normalized.replace(/[\u0000-\u001F\u007F\s]/g, (character) => encodeURIComponent(character));
}

function safeLocale(locale?: string): string {
  const normalized = locale?.trim();
  return normalized && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(normalized)
    ? normalized
    : 'und';
}
