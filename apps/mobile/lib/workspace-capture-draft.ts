import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WORKSPACE_TEMPLATES,
  type WorkspaceSourceReference,
  type WorkspaceTemplate,
} from '@second-brain/shared';
import { workspaceCaptureSignature } from './workspace-capture-flow';

const VERSION = 1 as const;
const PREFIX = 'sb.workspace.capture.v1';
export const MAX_WORKSPACE_CAPTURE_SOURCES = 50;

export type WorkspaceCaptureMode = 'text' | 'file' | 'photo' | 'voice' | 'library';

export interface WorkspaceCaptureDraft {
  version: typeof VERSION;
  mode: WorkspaceCaptureMode | null;
  title: string;
  objective: string;
  template: WorkspaceTemplate;
  initialContent: string;
  sources: WorkspaceSourceReference[];
  trackedDocumentId: string | null;
  attachmentId: string | null;
  createRequestId: string | null;
  createSignature: string | null;
  updatedAt: string;
}

function storageKey(userId: string): string {
  return `${PREFIX}.${userId}`;
}

export async function loadWorkspaceCaptureDraft(userId: string): Promise<WorkspaceCaptureDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<WorkspaceCaptureDraft>;
    if (value.version !== VERSION) return null;
    return {
      version: VERSION,
      mode: isCaptureMode(value.mode) ? value.mode : null,
      title: typeof value.title === 'string' ? value.title.slice(0, 200) : '',
      objective: typeof value.objective === 'string' ? value.objective.slice(0, 2_000) : '',
      template: WORKSPACE_TEMPLATES.includes(value.template as WorkspaceTemplate)
        ? value.template as WorkspaceTemplate
        : 'assignment',
      initialContent: typeof value.initialContent === 'string' ? value.initialContent.slice(0, 200_000) : '',
      sources: normalizeSources(value.sources),
      trackedDocumentId: typeof value.trackedDocumentId === 'string' && value.trackedDocumentId.trim()
        ? value.trackedDocumentId.trim()
        : null,
      attachmentId: typeof value.attachmentId === 'string' && value.attachmentId.trim()
        ? value.attachmentId.trim().slice(0, 200)
        : null,
      createRequestId: typeof value.createRequestId === 'string' && value.createRequestId.trim()
        ? value.createRequestId.trim().slice(0, 200)
        : null,
      createSignature: normalizeCreateSignature(value.createSignature),
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveWorkspaceCaptureDraft(
  userId: string,
  draft: Omit<WorkspaceCaptureDraft, 'version' | 'updatedAt'>,
): Promise<void> {
  const value: WorkspaceCaptureDraft = {
    version: VERSION,
    mode: draft.mode,
    title: draft.title.slice(0, 200),
    objective: draft.objective.slice(0, 2_000),
    template: draft.template,
    initialContent: draft.initialContent.slice(0, 200_000),
    sources: normalizeSources(draft.sources),
    trackedDocumentId: draft.trackedDocumentId?.trim() || null,
    attachmentId: draft.attachmentId?.trim().slice(0, 200) || null,
    createRequestId: draft.createRequestId?.trim().slice(0, 200) || null,
    createSignature: normalizeCreateSignature(draft.createSignature),
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(value));
}

export async function clearWorkspaceCaptureDraft(userId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId));
}

export function mergeWorkspaceSources(
  current: readonly WorkspaceSourceReference[],
  additions: readonly WorkspaceSourceReference[],
): WorkspaceSourceReference[] {
  const seen = new Set<string>();
  return [...current, ...additions].slice(0, 100).flatMap((source) => {
    if (!source || !['document', 'collection', 'research-source'].includes(source.kind) || !source.id?.trim()) return [];
    const key = `${source.kind}:${source.id.trim()}`;
    if (seen.has(key) || seen.size >= MAX_WORKSPACE_CAPTURE_SOURCES) return [];
    seen.add(key);
    return [{
      ...source,
      id: source.id.trim(),
      ...(source.title?.trim() ? { title: source.title.trim().slice(0, 200) } : {}),
    }];
  });
}

function normalizeSources(value: unknown): WorkspaceSourceReference[] {
  return Array.isArray(value) ? mergeWorkspaceSources([], value as WorkspaceSourceReference[]) : [];
}

function isCaptureMode(value: unknown): value is WorkspaceCaptureMode {
  return value === 'text' || value === 'file' || value === 'photo' || value === 'voice' || value === 'library';
}

function normalizeCreateSignature(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim();
  return /^aw1-v1:\d+:[0-9a-f]{32}$/.test(normalized)
    ? normalized
    : workspaceCaptureSignature(value);
}
