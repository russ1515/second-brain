import { api, type ApiProblem } from './api';

export type CopilotRecord = Record<string, unknown>;
export type CopilotSource = { kind?: string; label?: string; status?: string };
export type CopilotTrace = { provider?: string; model?: string; costStatus?: string; correlation?: string };
export type CopilotProposal = { status?: string; reason?: string };

export interface CopilotReply {
  conversationId?: string;
  answer?: string;
  status?: string;
  sources: CopilotSource[];
  proposal?: CopilotProposal;
  trace?: CopilotTrace;
}

export interface CopilotCapabilities {
  state: 'loading' | 'available' | 'forbidden' | 'unavailable' | 'error';
  data?: CopilotRecord;
  reason?: string;
}

function record(value: unknown): CopilotRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as CopilotRecord : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function source(value: unknown): CopilotSource | undefined {
  const item = record(value);
  if (!item) return undefined;
  return { kind: text(item.kind), label: text(item.label), status: text(item.status) };
}

function reply(value: unknown): CopilotReply {
  const root = record(value) ?? {};
  const traceRecord = record(root.trace);
  const proposalRecord = record(root.proposal);
  return {
    conversationId: text(root.conversationId), answer: text(root.answer), status: text(root.status),
    sources: Array.isArray(root.sources) ? root.sources.map(source).filter((item): item is CopilotSource => Boolean(item)) : [],
    proposal: proposalRecord ? { status: text(proposalRecord.status), reason: text(proposalRecord.reason) } : undefined,
    trace: traceRecord ? { provider: text(traceRecord.provider), model: text(traceRecord.model), costStatus: text(traceRecord.costStatus), correlation: text(traceRecord.correlation) } : undefined,
  };
}

export async function getCopilotCapabilities(): Promise<CopilotCapabilities> {
  try {
    const value = await api<unknown>('/admin/copilot/capabilities');
    return { state: 'available', data: record(value) };
  } catch (error) {
    const problem = error as ApiProblem;
    if (problem.status === 403) return { state: 'forbidden', reason: problem.message };
    if (problem.status === 404) return { state: 'unavailable', reason: problem.message };
    return { state: 'error', reason: problem.message };
  }
}

/** Read-only inquiry. The client intentionally has no action/proposal endpoint. */
export async function queryAdminCopilot(query: string, conversationId?: string): Promise<CopilotReply> {
  return reply(await api<unknown>('/admin/copilot/query', {
    method: 'POST',
    body: JSON.stringify({ query, ...(conversationId ? { conversationId } : {}) }),
  }, false));
}
