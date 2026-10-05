import type { Locale } from './i18n';

const copy = {
  en: {
    title: 'Admin Copilot', subtitle: 'Read-only operational assistance grounded in available evidence.', readOnly: 'READ ONLY — no client-side action execution',
    loading: 'Loading Copilot capabilities…', unavailable: 'NOT_AVAILABLE', forbidden: 'This Copilot capability is not available for your role.',
    capabilityUnavailable: 'The Copilot service is not available in this environment.', refresh: 'Refresh', retry: 'Retry',
    prompt: 'Ask a grounded operational question', promptHint: 'Do not include passwords, tokens, keys or other secrets.', send: 'Ask Copilot', sending: 'Asking Copilot…',
    inputRequired: 'Enter a question before submitting.', answer: 'Answer', noAnswer: 'NOT_AVAILABLE', sources: 'Sources and proof', noSources: 'NOT_AVAILABLE',
    trace: 'Instrumentation trace', provider: 'Provider', model: 'Model', costStatus: 'Cost status', correlation: 'Correlation', status: 'Status',
    proposal: 'Proposal', proposalReadOnly: 'Proposal recorded for human review only. No action was executed.',
    notConfigured: 'NOT_CONFIGURED', notAvailable: 'NOT_AVAILABLE', notSupported: 'NOT_SUPPORTED', notInstrumented: 'NOT_INSTRUMENTED', unknown: 'UNKNOWN',
    insufficientData: 'INSUFFICIENT_DATA', businessDecisionRequired: 'BUSINESS_DECISION_REQUIRED',
    conversation: 'Conversation', newConversation: 'New conversation', serverError: 'The Copilot request could not be completed.',
  },
  fr: {
    title: 'Copilot Admin', subtitle: 'Assistance opérationnelle en lecture seule, fondée sur les preuves disponibles.', readOnly: 'LECTURE SEULE — aucune action côté client',
    loading: 'Chargement des capacités Copilot…', unavailable: 'NOT_AVAILABLE', forbidden: 'Cette capacité Copilot n’est pas disponible pour votre rôle.',
    capabilityUnavailable: 'Le service Copilot n’est pas disponible dans cet environnement.', refresh: 'Actualiser', retry: 'Réessayer',
    prompt: 'Posez une question opérationnelle fondée', promptHint: 'N’incluez ni mot de passe, ni token, ni clé, ni autre secret.', send: 'Interroger le Copilot', sending: 'Interrogation du Copilot…',
    inputRequired: 'Saisissez une question avant l’envoi.', answer: 'Réponse', noAnswer: 'NOT_AVAILABLE', sources: 'Sources et preuves', noSources: 'NOT_AVAILABLE',
    trace: 'Trace d’instrumentation', provider: 'Fournisseur', model: 'Modèle', costStatus: 'État du coût', correlation: 'Corrélation', status: 'État',
    proposal: 'Proposition', proposalReadOnly: 'Proposition enregistrée pour revue humaine uniquement. Aucune action n’a été exécutée.',
    notConfigured: 'NOT_CONFIGURED', notAvailable: 'NOT_AVAILABLE', notSupported: 'NOT_SUPPORTED', notInstrumented: 'NOT_INSTRUMENTED', unknown: 'UNKNOWN',
    insufficientData: 'INSUFFICIENT_DATA', businessDecisionRequired: 'BUSINESS_DECISION_REQUIRED',
    conversation: 'Conversation', newConversation: 'Nouvelle conversation', serverError: 'La requête Copilot n’a pas pu être effectuée.',
  },
} as const;

export type CopilotCopyKey = keyof typeof copy.en;
export function cp(locale: Locale, key: CopilotCopyKey): string { return copy[locale][key]; }
