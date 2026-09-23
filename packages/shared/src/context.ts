/**
 * Shared UX context contract.
 *
 * Context is deliberately made of references and small display metadata. Full
 * domain objects, credentials and provider payloads do not belong here.
 */

export const CONTEXT_VERSION = 1 as const;
export const MAX_CONTEXT_ITEMS = 32;
export const MAX_CONTEXT_SERIALIZED_CHARS = 32_768;

export type ContextScope =
  | 'permanent-profile'
  | 'space'
  | 'active-object'
  | 'experience-session'
  | 'current-turn';

export type ContextKind =
  | 'user-profile'
  | 'brain'
  | 'document'
  | 'document-collection'
  | 'concept'
  | 'lesson'
  | 'goal'
  | 'exam'
  | 'language'
  | 'workspace'
  | 'tutor-session'
  | 'research'
  | 'revision'
  | 'learning-path';

export type ContextVisibility = 'visible' | 'summary' | 'hidden';

export interface ContextItem {
  /** Stable within one context snapshot. */
  id: string;
  kind: ContextKind;
  scope: ContextScope;
  /** Domain id/path. Never a credential or a full domain object. */
  referenceId?: string;
  /** Optional, already-safe label for a future ContextBar. */
  label?: string;
  /** Tie-breaker within a layer (0..100). Layer priority remains authoritative. */
  priority: number;
  visibility: ContextVisibility;
  addedAt: string;
  expiresAt?: string;
  /** Small, non-sensitive scalar display metadata only. */
  metadata?: Record<string, string | number | boolean | null>;
}

export type ContextItemInput = Omit<ContextItem, 'addedAt'> & {
  addedAt?: string;
};

export interface ExperienceContext {
  version: typeof CONTEXT_VERSION;
  ownerUserId: string;
  capturedAt: string;
  items: ContextItem[];
}

export interface ContextValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Override order validated in UX-1: current turn > active object > experience
 * session > space > permanent profile.
 */
export const CONTEXT_SCOPE_PRIORITY: Readonly<Record<ContextScope, number>> = {
  'permanent-profile': 10,
  space: 20,
  'experience-session': 30,
  'active-object': 40,
  'current-turn': 50,
};

const CONTEXT_KINDS: readonly ContextKind[] = [
  'user-profile',
  'brain',
  'document',
  'document-collection',
  'concept',
  'lesson',
  'goal',
  'exam',
  'language',
  'workspace',
  'tutor-session',
  'research',
  'revision',
  'learning-path',
];

const CONTEXT_SCOPES = Object.keys(CONTEXT_SCOPE_PRIORITY) as ContextScope[];
const CONTEXT_VISIBILITIES: readonly ContextVisibility[] = [
  'visible',
  'summary',
  'hidden',
];
const SENSITIVE_KEY =
  /(^|[_-])(secret|password|credential|authorization|cookie|token|api[_-]?key)($|[_-])/i;

export function createContext(
  ownerUserId: string,
  inputs: readonly ContextItemInput[] = [],
  now = new Date(),
): ExperienceContext {
  const capturedAt = now.toISOString();
  const context: ExperienceContext = {
    version: CONTEXT_VERSION,
    ownerUserId,
    capturedAt,
    items: inputs.map((item) => ({
      ...item,
      priority: item.priority,
      addedAt: item.addedAt ?? capturedAt,
    })),
  };
  assertValidContext(context);
  return sortContext(context);
}

export function upsertContextItem(
  context: ExperienceContext,
  input: ContextItemInput,
  now = new Date(),
): ExperienceContext {
  const without = context.items.filter(
    (item) => !(item.id === input.id && item.kind === input.kind),
  );
  return createContext(
    context.ownerUserId,
    [...without, { ...input, addedAt: input.addedAt ?? now.toISOString() }],
    now,
  );
}

export function removeContextItem(
  context: ExperienceContext,
  id: string,
  kind?: ContextKind,
  now = new Date(),
): ExperienceContext {
  return createContext(
    context.ownerUserId,
    context.items.filter(
      (item) => item.id !== id || (kind !== undefined && item.kind !== kind),
    ),
    now,
  );
}

export function contextPriority(item: ContextItem): number {
  return CONTEXT_SCOPE_PRIORITY[item.scope] * 1_000 + clampPriority(item.priority);
}

/** Small, useful subset intended for the future ContextBar. */
export function contextItemsForDisplay(
  context: ExperienceContext,
  limit = 5,
  now = new Date(),
): ContextItem[] {
  return context.items
    .filter((item) => item.visibility !== 'hidden' && !isExpired(item, now))
    .sort(compareContextItems)
    .slice(0, Math.max(0, Math.min(limit, MAX_CONTEXT_ITEMS)));
}

export function serializeContext(context: ExperienceContext): string {
  assertValidContext(context);
  const serialized = JSON.stringify(sortContext(context));
  if (serialized.length > MAX_CONTEXT_SERIALIZED_CHARS) {
    throw new Error('Context payload exceeds the serialized size limit.');
  }
  return serialized;
}

export function restoreContext(
  serialized: string,
  expectedOwnerUserId: string,
  now = new Date(),
): ExperienceContext {
  if (serialized.length > MAX_CONTEXT_SERIALIZED_CHARS) {
    throw new Error('Context payload exceeds the serialized size limit.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('Context payload is not valid JSON.');
  }
  assertValidContext(parsed);
  if (parsed.ownerUserId !== expectedOwnerUserId) {
    throw new Error('Context owner does not match the authenticated user.');
  }
  return sortContext({
    ...parsed,
    capturedAt: now.toISOString(),
    items: parsed.items.filter((item) => !isExpired(item, now)),
  });
}

export function validateContext(value: unknown): ContextValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Context must be an object.'] };
  if (value.version !== CONTEXT_VERSION) errors.push('Unsupported context version.');
  if (!isBoundedString(value.ownerUserId, 1, 200)) errors.push('Invalid context owner.');
  if (!isIsoDate(value.capturedAt)) errors.push('Invalid context capture timestamp.');
  if (!Array.isArray(value.items)) {
    errors.push('Context items must be an array.');
    return { valid: false, errors };
  }
  if (value.items.length > MAX_CONTEXT_ITEMS) errors.push('Too many context items.');
  for (const [index, item] of value.items.entries()) {
    if (!isRecord(item)) {
      errors.push(`Context item ${index} must be an object.`);
      continue;
    }
    if (!isBoundedString(item.id, 1, 200)) errors.push(`Context item ${index} has an invalid id.`);
    if (!CONTEXT_KINDS.includes(item.kind as ContextKind)) errors.push(`Context item ${index} has an invalid kind.`);
    if (!CONTEXT_SCOPES.includes(item.scope as ContextScope)) errors.push(`Context item ${index} has an invalid scope.`);
    if (!CONTEXT_VISIBILITIES.includes(item.visibility as ContextVisibility)) errors.push(`Context item ${index} has invalid visibility.`);
    if (!Number.isFinite(item.priority) || Number(item.priority) < 0 || Number(item.priority) > 100) errors.push(`Context item ${index} has invalid priority.`);
    if (!isIsoDate(item.addedAt)) errors.push(`Context item ${index} has an invalid addedAt.`);
    if (item.expiresAt !== undefined && !isIsoDate(item.expiresAt)) errors.push(`Context item ${index} has an invalid expiresAt.`);
    if (item.referenceId !== undefined && !isBoundedString(item.referenceId, 1, 500)) errors.push(`Context item ${index} has an invalid reference.`);
    if (item.label !== undefined && !isBoundedString(item.label, 1, 200)) errors.push(`Context item ${index} has an invalid label.`);
    if (item.metadata !== undefined) validateMetadata(item.metadata, index, errors);
  }
  try {
    if (JSON.stringify(value).length > MAX_CONTEXT_SERIALIZED_CHARS) {
      errors.push('Context payload exceeds the serialized size limit.');
    }
  } catch {
    errors.push('Context payload is not serializable.');
  }
  return { valid: errors.length === 0, errors };
}

export function assertValidContext(value: unknown): asserts value is ExperienceContext {
  const result = validateContext(value);
  if (!result.valid) throw new Error(result.errors.join(' '));
}

function validateMetadata(value: unknown, index: number, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`Context item ${index} metadata must be an object.`);
    return;
  }
  const entries = Object.entries(value);
  if (entries.length > 12) errors.push(`Context item ${index} has too much metadata.`);
  for (const [key, metadataValue] of entries) {
    if (SENSITIVE_KEY.test(key)) errors.push(`Context item ${index} contains a sensitive metadata key.`);
    if (!isBoundedString(key, 1, 80)) errors.push(`Context item ${index} has an invalid metadata key.`);
    if (
      metadataValue !== null &&
      typeof metadataValue !== 'string' &&
      typeof metadataValue !== 'number' &&
      typeof metadataValue !== 'boolean'
    ) {
      errors.push(`Context item ${index} metadata must contain scalar values.`);
    }
    if (typeof metadataValue === 'string' && metadataValue.length > 300) {
      errors.push(`Context item ${index} metadata value is too long.`);
    }
  }
}

function sortContext(context: ExperienceContext): ExperienceContext {
  return { ...context, items: [...context.items].sort(compareContextItems) };
}

function compareContextItems(a: ContextItem, b: ContextItem): number {
  return contextPriority(b) - contextPriority(a) || b.addedAt.localeCompare(a.addedAt);
}

function isExpired(item: ContextItem, now: Date): boolean {
  return item.expiresAt !== undefined && new Date(item.expiresAt).getTime() <= now.getTime();
}

function clampPriority(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
