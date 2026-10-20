import type { ExerciseType } from './lesson';
import type { LanguageTrainingFormat } from './language-mastery';
import { SUPPORTED_LANGUAGES, toSupportedLanguage } from './languages';
import { LANGUAGE_EXERCISE_INSTRUCTION_COPY } from './language-exercise-instruction-copy';

/** Presentation keys, not another exercise-type or scoring enum. */
export const LANGUAGE_EXERCISE_INSTRUCTION_KEYS = [
  'choose', 'answer', 'solve', 'case', 'discriminate', 'fillBlank', 'reorder',
  'matchRegister', 'correctError', 'listen', 'write', 'speak', 'dialogue',
  'letterName', 'spellWord', 'spellName', 'letterAfter', 'letterBefore',
  'alphabetFirst', 'letterBetween', 'letterNameVariant',
] as const;
export const LANGUAGE_EXERCISE_INSTRUCTION_COPY_KEYS = [
  ...LANGUAGE_EXERCISE_INSTRUCTION_KEYS, 'american', 'british',
] as const;
export type LanguageExerciseInstructionKey = typeof LANGUAGE_EXERCISE_INSTRUCTION_COPY_KEYS[number];

export interface LanguageExerciseInstruction {
  key: LanguageExerciseInstructionKey;
  /** Target-language operands only; full provider-authored instructions are not
   * accepted in place of a localized shell. `variant` is american|british. */
  params?: Readonly<Record<string, string>>;
}

export interface LanguageExercisePresentationInput {
  question: string;
  type?: ExerciseType;
  languageFormat?: LanguageTrainingFormat;
  audioText?: string;
  instruction?: LanguageExerciseInstruction;
  /** Semantic learning material, never an instruction. Separate from the
   * canonical question so presentation cannot alter assessment hashes. */
  targetText?: string;
}

export type LanguageExercisePresentation = {
  normalized: true;
  instruction: LanguageExerciseInstruction;
  instructionText: string;
  targetText?: string;
  /** Backwards-compatible public rendering; never write it into the canonical
   * assessment question, rubric, submission, or source-version hash. */
  prompt: string;
} | {
  normalized: false;
  reason: 'NOT_NORMALIZABLE' | 'UNSUPPORTED_SUPPORT_LANGUAGE' | 'INVALID_DESCRIPTOR' | 'MISSING_TRANSLATION';
  prompt: string;
};

export const LANGUAGE_EXERCISE_TYPE_INSTRUCTIONS = {
  qcm: 'choose', open: 'answer', exercise: 'solve', case: 'case',
} as const satisfies Record<ExerciseType, LanguageExerciseInstructionKey>;

export const LANGUAGE_TRAINING_FORMAT_INSTRUCTIONS = {
  'recognition-mcq': 'choose',
  'contextual-discrimination': 'discriminate',
  'fill-blank-no-hint': 'fillBlank',
  'sentence-reconstruction': 'reorder',
  'register-matching': 'matchRegister',
  'error-correction': 'correctError',
  'listening-discrimination': 'listen',
  'guided-writing': 'write',
  'voice-pronunciation': 'speak',
  'mini-dialogue': 'dialogue',
} as const satisfies Record<LanguageTrainingFormat, LanguageExerciseInstructionKey>;

export const LANGUAGE_EXERCISE_INSTRUCTION_PARAMS: Readonly<Record<typeof LANGUAGE_EXERCISE_INSTRUCTION_KEYS[number], readonly string[]>> = {
  choose: [], answer: [], solve: [], case: [], discriminate: [], fillBlank: [],
  reorder: [], matchRegister: [], correctError: [], listen: [], write: [], speak: [], dialogue: [],
  letterName: ['letter'], spellWord: ['word'], spellName: ['name'], letterAfter: ['letter'],
  letterBefore: ['letter'], alphabetFirst: [], letterBetween: ['first', 'last'],
  letterNameVariant: ['letter', 'variant'],
};

function comparableInstruction(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Exact owned shells only, across the existing 34 catalogues. This is not a
 * heuristic translation/detection of arbitrary short target-language prose. */
const OWNED_INSTRUCTION_SHELLS = [...new Set(Object.values(LANGUAGE_EXERCISE_INSTRUCTION_COPY)
  .flatMap(copy => LANGUAGE_EXERCISE_INSTRUCTION_KEYS
    .filter(key => LANGUAGE_EXERCISE_INSTRUCTION_PARAMS[key].length === 0)
    .map(key => comparableInstruction(copy[key]))))];

function containsOwnedInstructionShell(text: string): boolean {
  const comparable = comparableInstruction(text);
  return OWNED_INSTRUCTION_SHELLS.some(shell => shell.length > 0 && comparable.startsWith(shell));
}

/** The recognized legacy forms are a bounded migration of proven English
 * instruction grammars, not a language detector or a free-form translator.
 * Every match is anchored; an unknown modifier must not silently disappear. */
function legacyInstruction(
  question: string,
  targetLanguageCode?: string,
  requireTargetMatch = true,
): LanguageExerciseInstruction | null {
  let text = question.trim().replace(/\s+/g, ' ');
  // This provider-authored preface was observed on a written MCQ without any
  // audio. It is not evidence that listening took place. Actual audio modality
  // is handled separately by trusted exercise metadata below.
  text = text.replace(/^Listen and choose the correct name of the letter:\s*/i, '');
  const q = `["'“”‘’]`;
  const letter = `(${q})([\\p{L}\\p{M}]+)${q}`;
  const operand = `(${q})([^"'“”‘’\\r\\n]+)${q}`;
  const targetMatches = (name: string | undefined): boolean => {
    if (!name) return true;
    const explicit = toSupportedLanguage(name);
    const target = toSupportedLanguage(targetLanguageCode);
    return !!explicit && (!requireTargetMatch || (!!target && explicit === target));
  };
  let match: RegExpMatchArray | null;
  if ((match = text.match(new RegExp(`^What is the name of the letter ${letter}\\?$`, 'iu')))) {
    return { key: 'letterName', params: { letter: match[2]! } };
  }
  if ((match = text.match(new RegExp(`^How do you say the name of the letter ${letter} in (American|British) ([\\p{L} -]+)\\?$`, 'iu')))) {
    if (!targetMatches(match[4])) return null;
    return { key: 'letterNameVariant', params: { letter: match[2]!, variant: match[3]!.toLowerCase() } };
  }
  if ((match = text.match(new RegExp(`^(?:How do you spell|Spell) the (word|name) ${operand} using (?:([\\p{L} -]+) )?letter names[.?]$`, 'iu')))) {
    if (!targetMatches(match[4])) return null;
    return { key: match[1]!.toLowerCase() === 'word' ? 'spellWord' : 'spellName',
      params: { [match[1]!.toLowerCase() === 'word' ? 'word' : 'name']: match[3]! } };
  }
  if ((match = text.match(new RegExp(`^Which letter comes (after|before) ${letter} in the(?: ([\\p{L} -]+))? alphabet\\?$`, 'iu')))) {
    if (!targetMatches(match[4])) return null;
    return { key: match[1]!.toLowerCase() === 'after' ? 'letterAfter' : 'letterBefore', params: { letter: match[3]! } };
  }
  if ((match = text.match(/^What is the first letter of the(?: ([\p{L} -]+))? alphabet\?$/iu))) {
    if (!targetMatches(match[1])) return null;
    return { key: 'alphabetFirst' };
  }
  if ((match = text.match(new RegExp(`^Which letter is between ${letter} and ${letter} in the(?: ([\\p{L} -]+))? alphabet\\?$`, 'iu')))) {
    if (!targetMatches(match[5])) return null;
    return { key: 'letterBetween', params: { first: match[2]!, last: match[4]! } };
  }
  return null;
}

function validDescriptor(value: unknown): value is LanguageExerciseInstruction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some(key => key !== 'key' && key !== 'params')) return false;
  if (typeof object.key !== 'string' || !Object.prototype.hasOwnProperty.call(LANGUAGE_EXERCISE_INSTRUCTION_PARAMS, object.key)) return false;
  const expected = LANGUAGE_EXERCISE_INSTRUCTION_PARAMS[object.key as keyof typeof LANGUAGE_EXERCISE_INSTRUCTION_PARAMS];
  const params = object.params;
  if (params !== undefined && (!params || typeof params !== 'object' || Array.isArray(params))) return false;
  const actual = (params ?? {}) as Record<string, unknown>;
  if (Object.keys(actual).length !== expected.length || expected.some(key =>
    !Object.prototype.hasOwnProperty.call(actual, key) || typeof actual[key] !== 'string' || !(actual[key] as string).trim())) return false;
  if (object.key === 'letterNameVariant' && actual.variant !== 'american' && actual.variant !== 'british') return false;
  return true;
}

/** Resolve a single structural instruction in the explicitly chosen teaching
 * language. Missing translations never fall back to English. */
export function getLanguageExerciseInstructionText(
  instruction: LanguageExerciseInstruction,
  supportLanguageCode: string,
): string | null {
  const code = toSupportedLanguage(supportLanguageCode);
  if (!code || !validDescriptor(instruction)) return null;
  const copy = LANGUAGE_EXERCISE_INSTRUCTION_COPY[code];
  const template = copy?.[instruction.key];
  if (!template?.trim()) return null;
  const required = LANGUAGE_EXERCISE_INSTRUCTION_PARAMS[instruction.key as keyof typeof LANGUAGE_EXERCISE_INSTRUCTION_PARAMS];
  const placeholders = [...new Set([...template.matchAll(/\{([A-Za-z]+)\}/g)].map(match => match[1]!))].sort();
  if (!required || placeholders.join('|') !== [...required].sort().join('|')) return null;
  const params = { ...instruction.params };
  if (instruction.key === 'letterNameVariant') {
    const variant = params.variant;
    if (variant !== 'american' && variant !== 'british') return null;
    const label = copy[variant];
    if (!label?.trim() || /[{}]/.test(label)) return null;
    params.variant = label;
  }
  let missing = false;
  const rendered = template.replace(/\{([A-Za-z]+)\}/g, (_whole, name: string) => {
    const value = params[name];
    if (typeof value !== 'string' || !value.trim()) { missing = true; return ''; }
    // Isolate only operands within RTL instructions; the target string is
    // unchanged and no bidi control is written into canonical exercise data.
    return SUPPORTED_LANGUAGES[code].rtl ? `\u2068${value}\u2069` : value;
  });
  return missing ? null : rendered;
}

/** Pure, read-only projection of an exercise. It neither grades nor grants
 * mastery. The caller must never persist `prompt` over canonical assessment
 * data. Legacy raw prose is not assumed to be safe semantic target content. */
export function resolveLanguageExercisePresentation(
  exercise: LanguageExercisePresentationInput,
  supportLanguageCode: string,
  targetLanguageCode?: string,
): LanguageExercisePresentation {
  const original = typeof exercise.question === 'string' ? exercise.question : '';
  const fail = (reason: Extract<LanguageExercisePresentation, { normalized: false }>['reason']): LanguageExercisePresentation =>
    ({ normalized: false, reason, prompt: original });
  if (!toSupportedLanguage(supportLanguageCode)) return fail('UNSUPPORTED_SUPPORT_LANGUAGE');
  const semantic = typeof exercise.targetText === 'string' ? exercise.targetText : undefined;
  let instruction: LanguageExerciseInstruction | null;
  if (exercise.instruction !== undefined) {
    if (!validDescriptor(exercise.instruction)) return fail('INVALID_DESCRIPTOR');
    instruction = { key: exercise.instruction.key, params: { ...exercise.instruction.params } };
  } else {
    instruction = legacyInstruction(original, targetLanguageCode);
    if (!instruction && semantic?.trim()) {
      const key = exercise.languageFormat
        ? LANGUAGE_TRAINING_FORMAT_INSTRUCTIONS[exercise.languageFormat]
        : LANGUAGE_EXERCISE_TYPE_INSTRUCTIONS[exercise.type ?? 'exercise'];
      if (key) instruction = { key };
    }
  }
  if (!instruction) return fail('NOT_NORMALIZABLE');
  // A generic shell alone does not express the learning task. Only semantic
  // families with explicit operands (or alphabetFirst) stand on their own.
  if (LANGUAGE_EXERCISE_INSTRUCTION_PARAMS[instruction.key as keyof typeof LANGUAGE_EXERCISE_INSTRUCTION_PARAMS]?.length === 0
    && instruction.key !== 'alphabetFirst' && !semantic?.trim()) return fail('INVALID_DESCRIPTOR');
  // A known provider-authored instruction must not be relabelled as target
  // material beneath a localized banner. Reuse only the proven legacy grammar;
  // ordinary target-language questions are not banned or language-classified.
  if (semantic?.trim() && (legacyInstruction(semantic, targetLanguageCode, false)
      || containsOwnedInstructionShell(semantic))) return fail('INVALID_DESCRIPTOR');
  let instructionText = getLanguageExerciseInstructionText(instruction, supportLanguageCode);
  if (!instructionText) return fail('MISSING_TRANSLATION');
  if (instruction.key === 'letterName' && exercise.audioText?.trim()
    && exercise.languageFormat === 'listening-discrimination') {
    const listening = getLanguageExerciseInstructionText({ key: 'listen' }, supportLanguageCode);
    if (!listening) return fail('MISSING_TRANSLATION');
    instructionText = `${listening} ${instructionText}`;
  }
  const targetText = semantic?.trim() ? semantic : undefined;
  return {
    normalized: true, instruction, instructionText,
    ...(targetText !== undefined ? { targetText } : {}),
    prompt: targetText === undefined ? instructionText : `${instructionText}\n${targetText}`,
  };
}

export const formatLanguageExercisePresentation = resolveLanguageExercisePresentation;
