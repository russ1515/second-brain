import type { ContextItem } from './context';
import type { ActionDestination } from './next-best-action';

export const LEARN_INTENTS = ['understand', 'learn', 'practice', 'research', 'create'] as const;
export type LearnIntent = (typeof LEARN_INTENTS)[number];
export type LearnResolvedIntent = LearnIntent | 'free';

export const LEARN_MODALITIES = ['write', 'speak', 'capture', 'import'] as const;
export type LearnModality = (typeof LEARN_MODALITIES)[number];

export const LEARN_DEPTHS = ['quick', 'standard', 'deep'] as const;
export type LearnDepth = (typeof LEARN_DEPTHS)[number];

export type LearnAttachmentKind = 'document' | 'image';
export type LearnExecution = 'navigate' | 'tutor-message' | 'tutor-voice' | 'upload';
export type LearnRoutingExplanation =
  | 'capture'
  | 'import'
  | 'voice'
  | 'free-question'
  | 'document-understanding'
  | 'concept-explanation'
  | 'explanation'
  | 'lesson'
  | 'guided-session'
  | 'learning-path'
  | 'document-learning'
  | 'practice'
  | 'document-practice'
  | 'oral-practice'
  | 'language-practice'
  | 'research-quick'
  | 'research-library'
  | 'research-deep'
  | 'create-quiz'
  | 'create-course'
  | 'create-work'
  | 'create-from-document';

export interface LearnRouteInput {
  text: string;
  selectedIntent: LearnIntent | null;
  modality: LearnModality;
  depth: LearnDepth;
  contexts?: readonly ContextItem[];
  hasAttachment?: boolean;
  attachmentKind?: LearnAttachmentKind;
}

export interface LearnReadyDecision {
  status: 'ready';
  intent: LearnResolvedIntent;
  inferred: boolean;
  explanation: LearnRoutingExplanation;
  execution: LearnExecution;
  destination: ActionDestination;
  requiresConfirmation: boolean;
  tutorMode?: 'free' | 'explain';
}

export interface LearnClarificationDecision {
  status: 'clarification';
  question: 'intent';
  options: readonly LearnIntent[];
}

export type LearnRouteDecision = LearnReadyDecision | LearnClarificationDecision;

/**
 * Small deterministic router for the Learn entry point. It only explains the
 * chosen product destination; it never exposes model reasoning or invents a
 * confidence score.
 */
export function routeLearnIntent(input: LearnRouteInput): LearnRouteDecision {
  const text = input.text.trim();
  // Route parameters are only a prefill seam. Keep the full draft locally and
  // avoid creating unbounded URLs for long pasted notes.
  const queryText = text.slice(0, 2_000);
  const contexts = input.contexts ?? [];
  const document = contexts.find((item) => item.kind === 'document' && item.referenceId);
  const concept = contexts.find((item) => item.kind === 'concept' && item.referenceId);

  if (input.modality === 'capture') {
    return ready(input.selectedIntent ?? 'understand', input.selectedIntent === null, 'capture', 'navigate', {
      kind: 'route', path: '/scan',
    });
  }

  if (input.modality === 'import' && input.hasAttachment) {
    return ready(input.selectedIntent ?? 'understand', input.selectedIntent === null, 'import', 'upload', {
      kind: 'route', path: input.attachmentKind === 'image' ? '/scan' : '/library',
    });
  }

  if (input.modality === 'speak') {
    return ready(input.selectedIntent ?? 'free', input.selectedIntent === null, 'voice', 'tutor-voice', {
      kind: 'route', path: '/tutor', params: { mode: input.selectedIntent === 'understand' ? 'explain' : 'free' },
    }, false, input.selectedIntent === 'understand' ? 'explain' : 'free');
  }

  const inferred = input.selectedIntent === null;
  const intent = input.selectedIntent ?? inferIntent(text);
  if (intent === null) {
    return { status: 'clarification', question: 'intent', options: LEARN_INTENTS };
  }

  if (intent === 'free') {
    return ready('free', true, 'free-question', 'tutor-message', {
      kind: 'route', path: '/tutor', params: { mode: 'free' },
    }, false, 'free');
  }

  if (intent === 'understand') {
    if (document?.referenceId) {
      const params: Record<string, string> = { documentId: document.referenceId, q: queryText };
      if (document.label) params.title = document.label;
      return ready(intent, inferred, 'document-understanding', 'navigate', {
        kind: 'route', path: '/library/ask', params,
      });
    }
    if (concept?.referenceId) {
      return ready(intent, inferred, 'concept-explanation', 'navigate', {
        kind: 'route', path: '/tutor', params: { mode: 'explain', q: queryText, conceptId: concept.referenceId },
      });
    }
    return ready(intent, inferred, 'explanation', 'tutor-message', {
      kind: 'route', path: '/tutor', params: { mode: 'explain' },
    }, false, 'explain');
  }

  if (intent === 'learn') {
    if (document?.referenceId) {
      return ready(intent, inferred, 'document-learning', 'navigate', {
        kind: 'document', id: document.referenceId, path: `/library/${encodeURIComponent(document.referenceId)}`, params: { action: 'learn', q: queryText },
      });
    }
    if (/(session guidee|guided session)/.test(normalize(text))) {
      return ready(intent, inferred, 'guided-session', 'navigate', {
        kind: 'route', path: '/daily-session', params: { topic: queryText },
      });
    }
    if (/(parcours|learning path|roadmap)/.test(normalize(text))) {
      return ready(intent, inferred, 'learning-path', 'navigate', {
        kind: 'route', path: '/adaptive-path', params: { topic: queryText },
      });
    }
    return ready(intent, inferred, 'lesson', 'navigate', {
      kind: 'route', path: '/lesson/new', params: { topic: queryText },
    });
  }

  if (intent === 'practice') {
    if (document?.referenceId && /(quiz|qcm|mcq|flashcard|carte)/.test(normalize(text))) {
      return ready(intent, inferred, 'document-practice', 'navigate', {
        kind: 'document', id: document.referenceId, path: `/library/${encodeURIComponent(document.referenceId)}`, params: { action: creationAction(text), q: queryText },
      });
    }
    if (isLanguageRequest(text)) {
      return ready(intent, inferred, 'language-practice', 'navigate', {
        kind: 'language', path: '/languages', params: { q: queryText },
      });
    }
    if (isOralRequest(text)) {
      return ready(intent, inferred, 'oral-practice', 'navigate', {
        kind: 'route', path: '/tutor', params: { mode: 'oral_exercise', q: queryText },
      });
    }
    return ready(intent, inferred, 'practice', 'navigate', {
      kind: 'route', path: '/examiner', params: { type: 'exercise', topic: queryText },
    });
  }

  if (intent === 'research') {
    if (input.depth === 'deep') {
      return ready(intent, inferred, 'research-deep', 'navigate', {
        kind: 'route', path: '/research', params: { depth: 'deep', q: queryText },
      }, true);
    }
    if (input.depth === 'quick') {
      return ready(intent, inferred, 'research-quick', 'navigate', {
        kind: 'route', path: '/research', params: { depth: 'quick', q: queryText },
      });
    }
    const params: Record<string, string> = { q: queryText };
    if (document?.referenceId) {
      params.documentId = document.referenceId;
      if (document.label) params.title = document.label;
    }
    return ready(intent, inferred, 'research-library', 'navigate', {
      kind: 'route', path: '/research', params: { ...params, depth: 'sourced' },
    });
  }

  if (document?.referenceId) {
    return ready(intent, inferred, 'create-from-document', 'navigate', {
      kind: 'document', id: document.referenceId, path: `/library/${encodeURIComponent(document.referenceId)}`, params: { action: creationAction(text), q: queryText },
    });
  }
  if (isQuizRequest(text)) {
    return ready(intent, inferred, 'create-quiz', 'navigate', {
      kind: 'route', path: '/examiner', params: { type: 'mcq', topic: queryText },
    });
  }
  if (isCourseRequest(text)) {
    return ready(intent, inferred, 'create-course', 'navigate', {
      kind: 'route', path: '/lesson/new', params: { topic: queryText },
    });
  }
  return ready(intent, inferred, 'create-work', 'navigate', {
    kind: 'workspace', path: '/library/workspace', params: { type: writingType(text), objective: queryText },
  });
}

export type LearnComposition = 'single-column' | 'split';

export function resolveLearnComposition(width: number): LearnComposition {
  if (!Number.isFinite(width) || width < 0) throw new Error('Learn viewport width must be non-negative.');
  return width >= 1_000 ? 'split' : 'single-column';
}

export type LearnDraftOutcome = 'completed' | 'navigated' | 'error' | 'quota' | 'upload-failed';

/** Drafts are cleared only after a server-backed action has completed. */
export function shouldClearLearnDraft(outcome: LearnDraftOutcome): boolean {
  return outcome === 'completed';
}

function ready(
  intent: LearnResolvedIntent,
  inferred: boolean,
  explanation: LearnRoutingExplanation,
  execution: LearnExecution,
  destination: ActionDestination,
  requiresConfirmation = false,
  tutorMode?: 'free' | 'explain',
): LearnReadyDecision {
  return { status: 'ready', intent, inferred, explanation, execution, destination, requiresConfirmation, tutorMode };
}

function inferIntent(text: string): LearnResolvedIntent | null {
  const value = normalize(text);
  if (!value) return null;
  if (isLanguageRequest(text) && isOralRequest(text)) return 'practice';
  if (/(cree|creer|create|redige|write|produis|generate|quiz|flashcard|dissertation|memoire|report|rapport|article)/.test(value)) return 'create';
  if (/(recherche|chercher|search|investigue|investigate|sources?|bibliograph|approfond)/.test(value)) return 'research';
  if (/(pratiqu|practice|exercice|exercise|entraine|train|teste-moi|test me|interroge-moi|oral)/.test(value)) return 'practice';
  if (/(apprend|learn|enseigne|teach|cours|lesson|maitriser|master)/.test(value)) return 'learn';
  if (/(explique|explain|comprend|understand|pourquoi|why|comment|how|qu.est.ce|what is|difference|resume|summari|analyse|analyz)/.test(value)) return 'understand';
  if (/\?$/.test(text) || /^(qui|que|quoi|ou|quand|combien|who|what|where|when|can|could|is|are|do|does)\b/.test(value)) return 'free';
  if (value.split(/\s+/).length <= 3) return null;
  return 'free';
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isLanguageRequest(value: string): boolean {
  return /(langue|language|anglais|english|espagnol|spanish|allemand|german|italien|italian|portugais|portuguese|arabe|arabic|chinois|chinese|japonais|japanese|coreen|korean|francais|french)/.test(normalize(value));
}

function isOralRequest(value: string): boolean {
  return /(oral|parler|speak|pronon|conversation|a voix)/.test(normalize(value));
}

function isQuizRequest(value: string): boolean {
  return /(quiz|qcm|mcq|flashcard|carte)/.test(normalize(value));
}

function isCourseRequest(value: string): boolean {
  return /(cours|course|lesson|lecon|parcours)/.test(normalize(value));
}

function creationAction(value: string): string {
  if (/(flashcard|carte)/.test(normalize(value))) return 'flashcards';
  if (/(quiz|qcm|mcq)/.test(normalize(value))) return 'quiz';
  return 'create';
}

function writingType(value: string): string {
  const normalized = normalize(value);
  if (/memoire|thesis/.test(normalized)) return 'memoire';
  if (/dissertation|essay/.test(normalized)) return 'dissertation';
  if (/rapport|report/.test(normalized)) return 'rapport';
  if (/article/.test(normalized)) return 'redaction';
  return 'redaction';
}
