import type { CefrLevel } from './language';
import { SUPPORTED_LANGUAGE_CODES, SUPPORTED_LANGUAGES, type SupportedLanguageCode } from './languages';

/** Authored linguistic metadata, not translated course prose or a claim that
 * the CEFR assigns grammatical constructions to particular levels. The CEFR
 * is a communicative framework; these local syllabus choices need review. */
export type LanguageCurriculumTargetFamily =
  | 'basics' | 'grammar' | 'morphology' | 'pronunciation' | 'register' | 'discourse';
export interface LanguageCurriculumStageTargets {
  basics: string[];
  grammar: string[];
  morphology: string[];
  pronunciation: string[];
  register: string[];
  discourse: string[];
}
export interface LanguageCurriculumProfile {
  languageId: SupportedLanguageCode;
  languageCode: SupportedLanguageCode;
  script: string;
  direction: 'ltr' | 'rtl';
  writingSystems: string[];
  pronunciationMetadataReference: string;
  wordOrder: string[];
  morphology: string[];
  verbSystem: string[];
  nounSystem: string[];
  agreement: string[];
  determiners: string[];
  pronouns: string[];
  questions: string[];
  negation: string[];
  register: string[];
  learnerDifficulties: string[];
  pragmatics: string[];
  stageTargets: Record<CefrLevel, LanguageCurriculumStageTargets>;
  reviewStatus: 'NEEDS_LINGUISTIC_REVIEW';
  supportStatus: 'AUTHORED_NOT_EXPERT_VALIDATED';
  /** Exact outstanding work; never infer a reviewed syllabus from coverage. */
  reviewSections: string[];
  sources: { url: string; scope: string }[];
  varietyNotes: string[];
}

interface ProfileSeed {
  script: string;
  writingSystems: string[];
  wordOrder: string[];
  morphology: string[];
  basics: [string, string, string];
  grammar: [string, string, string];
  verbs: [string, string, string];
  nouns: string[];
  agreement: string[];
  determiners: string[];
  pronouns: string[];
  questions: string[];
  negation: string[];
  register: [string, string, string];
  pronunciation: [string, string, string];
  discourse: [string, string, string];
  caveats?: string[];
  review?: string[];
  sources?: { url: string; scope: string }[];
}

/** These are task contexts, not a numeric difficulty multiplier. The target
 * language supplies the structures; the CEFR spine supplies communicative use.
 * Orthographic foundations are revisited as editing/literacy, not alphabet
 * instruction, at advanced stages. No audio target implies acoustic scoring. */
const STAGE_TASKS: Record<CefrLevel, Record<LanguageCurriculumTargetFamily, readonly [string, string, string]>> = {
  A1: {
    basics: ['Recognise core written forms in names and labels', 'Read short personal-information items', 'Produce legible everyday words'],
    grammar: ['Build a single personal-information clause', 'Ask and answer a short concrete question', 'Express a simple negative fact'],
    morphology: ['Recognise the core form and its communicative value', 'Produce a short affirmative or negative response', 'Choose a form for an immediate personal need'],
    pronunciation: ['Listen and imitate a short contrast in a meaningful word', 'Practise a short phrase with a model', 'Notice sound or timing distinctions without claiming acoustic certification'],
    register: ['Greet and introduce oneself appropriately', 'Choose a basic form of address', 'Make a short polite request'],
    discourse: ['Connect personal facts in a short turn', 'Understand a short familiar exchange', 'Write a very short practical message'],
  },
  A2: {
    basics: ['Read routine notices and everyday quantities', 'Apply orthographic conventions in a short practical message', 'Recognise familiar forms in a new everyday context'],
    grammar: ['Link routine actions and a simple reason', 'Describe an everyday event with appropriate time reference', 'Ask for clarification or practical information'],
    morphology: ['Select forms for a routine account rather than an isolated paradigm', 'Contrast a completed, ongoing or intended event where the language permits', 'Maintain person, number or other language-relevant concord in a short message'],
    pronunciation: ['Distinguish familiar words in a connected routine exchange', 'Practise phrase grouping and a short repair', 'Rehearse an everyday message without inferring pronunciation mastery from STT'],
    register: ['Use a suitable form for a service encounter', 'Choose a familiar or respectful routine request', 'Repair a misunderstanding courteously'],
    discourse: ['Sequence a short familiar account', 'Explain an everyday preference with a reason', 'Exchange practical information across several turns'],
  },
  B1: {
    basics: ['Read connected everyday prose independently', 'Check spelling and segmentation in a structured paragraph', 'Handle unfamiliar everyday written forms using context'],
    grammar: ['Narrate experiences and distinguish their time relationships', 'Explain a plan with linked reasons', 'Maintain reference across a short connected account'],
    morphology: ['Contrast language-relevant aspect, modality or reference in a narrative', 'Maintain forms across a multi-clause explanation', 'Repair a form that changes the intended relationship between events'],
    pronunciation: ['Practise intelligible connected speech in an experience narrative', 'Use phrasing to distinguish an explanation from a question', 'Identify a specific listening difficulty without claiming an acoustic score'],
    register: ['Adapt a request between familiar and study or work contexts', 'Express disagreement without unnecessary offence', 'Explain a cultural or pragmatic misunderstanding'],
    discourse: ['Sustain an everyday opinion with reasons', 'Narrate and respond to follow-up questions', 'Write a coherent account for a real recipient'],
  },
  B2: {
    basics: ['Read extended texts with reliable orthographic interpretation', 'Edit punctuation and written forms in a reasoned text', 'Select written conventions appropriate to a public or professional genre'],
    grammar: ['Contrast and justify viewpoints in linked clauses', 'Reformulate a complex relationship without changing its meaning', 'Manage information focus across an extended explanation'],
    morphology: ['Select forms to express hypothesis, viewpoint or stance where available', 'Contrast alternative constructions in an argument', 'Edit agreement or form choices that obscure a detailed explanation'],
    pronunciation: ['Practise clear grouping in a sustained explanation', 'Rehearse contrastive emphasis without changing lexical distinctions', 'Analyse an authentic listening challenge while keeping certification separate'],
    register: ['Choose an appropriate professional or academic tone', 'Soften and justify disagreement', 'Mediate a difference in communicative expectations'],
    discourse: ['Develop a structured argument and counterargument', 'Summarise and reformulate two viewpoints', 'Participate spontaneously in an extended discussion'],
  },
  C1: {
    basics: ['Interpret specialised written conventions in an extended source', 'Edit a dense academic or professional passage', 'Resolve orthographic or punctuation ambiguity using genre and context'],
    grammar: ['Express qualified claims and implicit logical relationships', 'Control information structure in a complex argument', 'Reformulate dense source content for a different audience'],
    morphology: ['Choose fine-grained aspect, stance or reference in specialised discourse', 'Evaluate formal alternatives and their implications', 'Maintain structural consistency across an extended synthesis'],
    pronunciation: ['Rehearse clear delivery of a dense presentation', 'Practise phrasing that distinguishes qualification and emphasis', 'Analyse subtle listening cues without treating imitation as acoustic proof'],
    register: ['Control academic or professional stance', 'Adjust politeness and distance in a sensitive exchange', 'Explain register-dependent implications without cultural stereotypes'],
    discourse: ['Synthesise complex sources with explicit attribution', 'Develop a qualified argument that anticipates objections', 'Organise an extended presentation and respond to probing questions'],
  },
  C2: {
    basics: ['Resolve subtle written ambiguities across contrasting genres', 'Proofread precise idiomatic prose without imposing another language script', 'Explain expressive effects of written conventions in context'],
    grammar: ['Reconstruct implied relationships and distinguish plausible readings', 'Choose a construction for a precise rhetorical effect', 'Recast a complex argument while retaining every qualification'],
    morphology: ['Explain subtle meaning changes between grammatical alternatives', 'Control marked and unmarked forms for genre and stance', 'Edit intricate discourse while preserving deliberate stylistic effects'],
    pronunciation: ['Rehearse flexible prosody for a nuanced public exchange', 'Interpret subtle delivery cues with explicit uncertainty', 'Practise precise delivery while leaving acoustic certification unclaimed'],
    register: ['Move flexibly between registers without caricaturing a community', 'Interpret irony and indirectness with contextual evidence', 'Mediate a sensitive pragmatic implication for a new audience'],
    discourse: ['Integrate competing arguments and implicit assumptions', 'Produce a nuanced synthesis across genres', 'Manage an idiomatic high-precision discussion without equating C2 with native identity'],
  },
};

const SEEDS: Record<SupportedLanguageCode, ProfileSeed> = {
  en: {
    script: 'Latn', writingSystems: ['Latin alphabet'], wordOrder: ['SVO', 'Auxiliary before subject in many direct questions'], morphology: ['Predominantly analytic with limited inflection'],
    basics: ['English letter-sound correspondences', 'word spacing and sentence punctuation', 'personal pronouns and everyday numbers'],
    grammar: ['subject-verb-object clause structure', 'auxiliary do and question formation', 'article choice with count and mass nouns'],
    verbs: ['lexical verb and auxiliary distinctions', 'tense-aspect combinations', 'modality and conditional constructions'],
    nouns: ['count and mass nouns', 'plural and possessive marking'], agreement: ['third-person singular present agreement'], determiners: ['definite, indefinite and zero article'], pronouns: ['subject, object and possessive forms'], questions: ['auxiliary inversion', 'subject versus object questions'], negation: ['auxiliary not', 'do-support where required'],
    register: ['informal and formal address without a grammatical T/V pair', 'polite indirect requests', 'academic stance and hedging'], pronunciation: ['vowel contrasts and lexical stress', 'consonant clusters and word endings', 'connected speech and sentence stress'], discourse: ['reference with pronouns and noun phrases', 'linking reasons and contrasting views', 'genre-specific stance and cohesion'],
  },
  fr: {
    script: 'Latn', writingSystems: ['Latin alphabet with French diacritics'], wordOrder: ['SVO', 'Clitic placement differs from full noun-phrase order'], morphology: ['Fusional nominal and verbal inflection'],
    basics: ['French accents and written sound correspondences', 'elision and word boundaries', 'gender and number with core noun phrases'], grammar: ['determiners and adjective agreement', 'object clitic placement', 'relative and subordinate clauses'], verbs: ['person and tense inflection', 'aspectual contrast in past narratives', 'mood and modality including subjunctive contexts'],
    nouns: ['masculine and feminine grammatical gender', 'number and partitive reference'], agreement: ['noun-adjective agreement', 'subject-verb and context-dependent participle agreement'], determiners: ['definite, indefinite and partitive articles'], pronouns: ['subject, tonic and object clitic forms', 'y and en'], questions: ['intonation, est-ce que and inversion by context'], negation: ['ne and negative expressions', 'spoken omission of ne as register variation'],
    register: ['tu and vous in context', 'spoken and edited written forms', 'academic qualification and argument'], pronunciation: ['oral and nasal vowels', 'liaison and enchaînement', 'rhythmic grouping and intonation'], discourse: ['reference and relative clauses', 'logical connectives and narrative time', 'synthesis and qualified argument'],
  },
  es: {
    script: 'Latn', writingSystems: ['Latin alphabet with Spanish diacritics'], wordOrder: ['SVO with discourse-driven variation', 'Subject omission licensed by context'], morphology: ['Fusional verbal inflection'],
    basics: ['Spanish spelling and accent marks', 'gender and number in core phrases', 'inverted question and exclamation punctuation'], grammar: ['ser and estar in context', 'object pronouns and clitic placement', 'relative clauses and information focus'], verbs: ['person inflection and stem alternations', 'past aspect contrasts', 'indicative and subjunctive in context'],
    nouns: ['gender and number'], agreement: ['noun-adjective and subject-verb agreement'], determiners: ['articles and demonstratives'], pronouns: ['subject omission', 'direct and indirect object forms'], questions: ['interrogative words and punctuation'], negation: ['no and negative concord'], register: ['tú, usted and regional address variation', 'polite requests', 'formal argument and stance'], pronunciation: ['lexical stress and vowel stability', 'rhotic contrasts', 'regional consonant variation without a single accent norm'], discourse: ['past narrative sequencing', 'argument with causal and concessive links', 'genre and regional idiom in context'],
  },
  de: {
    script: 'Latn', writingSystems: ['Latin alphabet with umlaut letters and ß'], wordOrder: ['Verb-second main clauses', 'Verb-final subordinate clauses'], morphology: ['Fusional case, gender and verb inflection'],
    basics: ['German letter-sound patterns', 'noun capitalisation', 'core gender and case-marked phrases'], grammar: ['verb-second and clause brackets', 'case-marked arguments and adjective endings', 'subordinate and relative clause order'], verbs: ['finite and non-finite forms', 'separable prefixes and auxiliaries', 'mood and reported or hypothetical stance'],
    nouns: ['three grammatical genders', 'four cases and plural classes'], agreement: ['determiner and adjective inflection', 'subject-verb agreement'], determiners: ['definite and indefinite paradigms'], pronouns: ['case forms', 'du, ihr and Sie'], questions: ['verb-first yes-no questions', 'question-word clauses'], negation: ['nicht and kein in context'], register: ['du and Sie', 'professional request conventions', 'formal argument and nominal style'], pronunciation: ['vowel length and umlaut contrasts', 'final devoicing', 'word stress and compound phrasing'], discourse: ['clause linking and reference', 'argument and reported discourse', 'cohesion in dense professional prose'],
  },
  it: {
    script: 'Latn', writingSystems: ['Latin alphabet with Italian accents'], wordOrder: ['SVO with discourse variation', 'Contextual subject omission'], morphology: ['Fusional nominal and verb inflection'],
    basics: ['Italian spelling and stress marks', 'article and noun combinations', 'word-final vowels'], grammar: ['gender and number agreement', 'object clitics and their placement', 'relative and subordinate clauses'], verbs: ['verb classes and person endings', 'past narrative and auxiliary selection', 'mood including subjunctive and conditional'], nouns: ['grammatical gender and number'], agreement: ['noun-adjective and subject-verb concord'], determiners: ['articles with phonological alternants'], pronouns: ['subject omission', 'clitic and tonic forms'], questions: ['intonation and interrogative phrases'], negation: ['non and negative expressions'], register: ['tu and Lei', 'courteous requests', 'formal written argument'], pronunciation: ['consonant length contrasts', 'word stress', 'vowel clarity and connected phrasing'], discourse: ['narrative sequencing', 'clitic reference and cohesion', 'argument and genre-sensitive stance'],
  },
  pt: {
    script: 'Latn', writingSystems: ['Latin alphabet with Portuguese diacritics'], wordOrder: ['SVO with discourse variation', 'Subject expression varies by variety'], morphology: ['Fusional nominal and verbal inflection'],
    basics: ['Portuguese spelling and accent marks', 'gender and number in noun phrases', 'core written and spoken correspondences'], grammar: ['ser and estar in context', 'clitic placement with variety specified', 'relative and subordinate clauses'], verbs: ['person and tense-aspect inflection', 'subjunctive and conditional contexts', 'personal infinitive in appropriate constructions'], nouns: ['grammatical gender and number'], agreement: ['noun-adjective and subject-verb concord'], determiners: ['articles and prepositional contractions'], pronouns: ['address forms vary between communities', 'clitic and tonic forms'], questions: ['interrogative words and intonation'], negation: ['não and negative concord'], register: ['tu, você and formal address by variety', 'service and workplace politeness', 'academic stance'], pronunciation: ['oral and nasal vowels', 'lexical stress', 'vowel reduction and consonants by selected variety'], discourse: ['past narratives', 'causal and concessive argument', 'formal synthesis with variety consistency'], caveats: ['European and Brazilian usage must not be silently mixed or ranked as correct versus incorrect.'],
  },
  nl: {
    script: 'Latn', writingSystems: ['Latin alphabet with Dutch digraph conventions'], wordOrder: ['Verb-second main clauses', 'Verb-final subordinate patterns'], morphology: ['Mixed analytic and inflectional structure'],
    basics: ['Dutch vowel spelling and digraphs', 'de and het noun phrases', 'core word spacing and compounds'], grammar: ['verb-second clauses and inversion', 'subordinate order and verb clusters', 'adjective inflection and reference'], verbs: ['finite endings and irregular stems', 'separable verbs and auxiliaries', 'aspectual and modal constructions'], nouns: ['common and neuter gender', 'plural and diminutive forms'], agreement: ['subject-verb and adjective concord'], determiners: ['de, het and een'], pronouns: ['subject, object and possessive forms', 'je, jij and u'], questions: ['verb-first questions and question words'], negation: ['niet and geen'], register: ['familiar and respectful address', 'practical requests', 'formal written argument'], pronunciation: ['long and short vowel contrasts', 'diphthongs and consonant clusters', 'stress and connected speech'], discourse: ['clause linking', 'reference across a narrative', 'argument and professional synthesis'],
  },
  pl: {
    script: 'Latn', writingSystems: ['Latin alphabet with Polish diacritics'], wordOrder: ['SVO with information-structural flexibility'], morphology: ['Fusional case and aspect-rich verbal structure'],
    basics: ['Polish letters and consonant digraphs', 'core case-marked phrases', 'gender and number in everyday nouns'], grammar: ['case-governed arguments and prepositions', 'agreement and information focus', 'relative and complement clauses'], verbs: ['person and past gender forms', 'perfective and imperfective aspect', 'modality and conditional forms'], nouns: ['case inflection', 'gender, animacy and masculine-personal contrasts'], agreement: ['case, number and gender concord'], determiners: ['no English-like article system', 'demonstrative and quantifier inflection'], pronouns: ['case forms and contextual subject omission'], questions: ['czy and interrogative phrases'], negation: ['nie and negative concord'], register: ['ty and respectful pan/pani forms', 'request conventions', 'formal argument'], pronunciation: ['sibilant contrasts', 'consonant clusters and palatalisation', 'stress and nasal-vowel realisations'], discourse: ['aspect in narration', 'information structure and reference', 'argument and indirect reported content'],
  },
  ru: {
    script: 'Cyrl', writingSystems: ['Russian Cyrillic alphabet'], wordOrder: ['SVO with discourse-sensitive flexibility'], morphology: ['Fusional case and verbal aspect'],
    basics: ['Cyrillic letter-sound correspondences', 'stress placement in familiar words', 'core case and gender patterns'], grammar: ['case-marked arguments and prepositions', 'adjective and pronoun concord', 'clause linking and information focus'], verbs: ['person and past gender forms', 'perfective and imperfective aspect', 'motion verbs and modality in context'], nouns: ['case and number', 'gender and animacy'], agreement: ['gender, number and case concord'], determiners: ['no definite or indefinite articles', 'demonstratives and quantifiers'], pronouns: ['case forms', 'ты and вы'], questions: ['intonation and interrogative phrases'], negation: ['не, нет and negative expressions'], register: ['ты and вы', 'practical and formal requests', 'academic argument and stance'], pronunciation: ['hard and soft consonants', 'stress and vowel reduction', 'intonation and consonant clusters'], discourse: ['aspectual narrative sequencing', 'topic and focus', 'synthesis and reported stance'],
  },
  zh: {
    script: 'Hans', writingSystems: ['Simplified Chinese characters', 'Hanyu Pinyin as pronunciation scaffold'], wordOrder: ['SVO', 'Topic-comment structures'], morphology: ['Predominantly analytic; no person-tense verb conjugation'],
    basics: ['simplified character components and stroke conventions', 'Pinyin syllables and lexical tones', 'core numerals and measure words'], grammar: ['topic-comment and word order', 'classifiers and noun modification with 的', 'complements and 把 or 被 constructions in context'], verbs: ['aspect particles 了, 过 and 着', 'modal and resultative constructions', 'time reference through context and adverbials'], nouns: ['classifiers', 'number is not a universal noun inflection'], agreement: ['no person or gender verb agreement'], determiners: ['demonstrative-classifier phrases', 'no English article paradigm'], pronouns: ['personal pronouns and contextual omission'], questions: ['吗, A-not-A and in-situ question words'], negation: ['不 and 没 in context'], register: ['respectful forms and address terms', 'spoken and formal written expression', 'indirectness with contextual evidence'], pronunciation: ['lexical tones and neutral tone', 'tone changes in connected speech', 'syllable initials and finals'], discourse: ['topic chains and omitted reference', 'aspectual narrative cohesion', 'formal connectors and compressed written discourse'], caveats: ['Chinese catalogue entry uses a Mandarin-oriented authored profile; this does not claim coverage of every Chinese language.'],
  },
  ja: {
    script: 'Jpan', writingSystems: ['Hiragana', 'Katakana', 'Kanji', 'Limited rōmaji scaffolding'], wordOrder: ['Predominantly SOV', 'Topic-comment and contextual omission'], morphology: ['Agglutinative predicate morphology'],
    basics: ['hiragana and katakana recognition', 'high-frequency kanji with contextual readings', 'mora timing and basic punctuation'], grammar: ['topic and case particles は, が, を, に and で', 'noun modification by preceding clauses', 'conditionals and clause linkage'], verbs: ['plain and polite predicate forms', 'て-form, aspect and auxiliaries', 'voice and modality in context'], nouns: ['no grammatical gender', 'counters and contextual number'], agreement: ['no person or number verb agreement'], determiners: ['demonstrative series', 'no English article paradigm'], pronouns: ['context-sensitive reference and omission', 'address terms rather than obligatory personal pronouns'], questions: ['か, intonation and in-situ question words'], negation: ['negative predicate forms'], register: ['plain and polite styles', 'honorific and humble expressions in context', 'spoken versus formal written stance'], pronunciation: ['mora length and gemination', 'vowel length and devoicing', 'pitch accent and phrase grouping as practice'], discourse: ['topic continuity and reference omission', 'explanation and contrast through clause endings', 'genre-sensitive academic synthesis'], sources: [{ url: 'https://www.jpf.go.jp/e/publish/japanese/index.html', scope: 'JF Standard: communicative curriculum design, not an official grammar-to-level table' }],
  },
  ko: {
    script: 'Kore', writingSystems: ['Hangul', 'Hanja only where relevant to a source'], wordOrder: ['Predominantly SOV', 'Topic-comment and contextual omission'], morphology: ['Agglutinative predicate endings'],
    basics: ['Hangul syllable-block decoding', 'batchim and basic spacing', 'core particles and address terms'], grammar: ['topic, subject and object particles', 'noun-modifying clauses', 'connective endings and information structure'], verbs: ['tense-aspect and modal endings', 'speech-level endings', 'honorific and voice constructions'], nouns: ['no grammatical gender', 'counters and contextual plurality'], agreement: ['no person-number verb agreement', 'honorific marking is socially conditioned'], determiners: ['demonstratives and counters', 'no English article paradigm'], pronouns: ['reference omission', 'address terms and social relationships'], questions: ['question endings and interrogative words'], negation: ['안, 못 and long negative constructions'], register: ['speech levels', 'honorific reference', 'spoken and formal written styles'], pronunciation: ['lenis, aspirated and tense contrasts', 'syllable-final neutralisation and linking', 'phrase grouping and intonation'], discourse: ['topic continuity', 'connective endings for reasons and contrasts', 'formal synthesis and stance'],
  },
  ar: {
    script: 'Arab', writingSystems: ['Arabic script', 'Vowel marks as an explicit learning scaffold'], wordOrder: ['VSO and SVO with construction-specific agreement'], morphology: ['Root-and-pattern plus affixal morphology'],
    basics: ['right-to-left reading and positional letter forms', 'short and long vowels in scaffolded script', 'root recognition in familiar word families'], grammar: ['nominal and verbal clauses', 'construct-state possession and definiteness', 'relative and subordinate clauses in standard Arabic'], verbs: ['root-pattern verb families', 'aspect, mood and person inflection', 'voice and modality in standard usage'], nouns: ['gender, dual and plural systems', 'case endings where the selected register uses them'], agreement: ['gender and number agreement', 'construction-specific and non-human plural agreement'], determiners: ['definite prefix al-', 'definiteness and construct-state relations'], pronouns: ['independent pronouns and suffixes'], questions: ['interrogative particles and question words'], negation: ['standard Arabic negative particles selected for tense and mood'], register: ['standard written and formal spoken Arabic', 'address and politeness in context', 'explicit distinction between standard and dialectal expressions'], pronunciation: ['consonant length and vowel length', 'emphatic and non-emphatic contrasts', 'pharyngeal and uvular contrasts as supported practice'], discourse: ['reference and connective relations', 'nominal style and rhetorical argument', 'genre-sensitive formal synthesis'], caveats: ['Authored structural targets refer to Modern Standard Arabic; a regional dialect is not silently substituted or claimed as covered.'], sources: [{ url: 'https://wals.info/languoid/lect/wals_code_ams', scope: 'Modern Standard Arabic identity and reference grammar bibliography' }],
  },
  hi: {
    script: 'Deva', writingSystems: ['Devanagari'], wordOrder: ['Predominantly SOV', 'Postpositions'], morphology: ['Inflectional and periphrastic verb structure'],
    basics: ['Devanagari consonants, vowel signs and conjuncts', 'core gender-marked noun phrases', 'everyday numbers and postpositions'], grammar: ['postpositional case relations', 'gender and number agreement', 'relative-correlative constructions'], verbs: ['aspect and auxiliary combinations', 'agreement across tense-aspect constructions', 'modality and conditional expression'], nouns: ['masculine and feminine gender', 'direct and oblique forms'], agreement: ['gender and number concord with construction-specific alignment'], determiners: ['demonstratives and quantifiers', 'no English article paradigm'], pronouns: ['levels of address', 'oblique pronoun forms'], questions: ['question words and polar-question particles'], negation: ['नहीं, न and मत by construction'], register: ['तू, तुम and आप by context', 'polite requests', 'formal and conversational lexical choices'], pronunciation: ['dental and retroflex contrasts', 'aspirated and unaspirated contrasts', 'vowel length and schwa behaviour'], discourse: ['postpositional reference chains', 'narration and explanation', 'formal argument and audience adaptation'],
  },
  tr: {
    script: 'Latn', writingSystems: ['Turkish Latin alphabet'], wordOrder: ['Predominantly SOV', 'Information-sensitive constituent order'], morphology: ['Agglutinative with vowel harmony'],
    basics: ['Turkish letters and vowel harmony', 'core suffix boundaries', 'basic nominal predicates'], grammar: ['case suffixes and postpositions', 'non-finite noun-modifying clauses', 'focus and constituent order'], verbs: ['tense-aspect-mood suffixes', 'reported or inferential information marking', 'voice and non-finite verb forms'], nouns: ['number, case and possession', 'no grammatical gender'], agreement: ['person and possessive agreement'], determiners: ['demonstratives and numeral phrases', 'indefinite bir in context'], pronouns: ['personal and reflexive forms', 'contextual omission'], questions: ['harmonic question particle and question words'], negation: ['verbal negative suffixes', 'değil in nominal predicates'], register: ['sen and siz', 'courteous indirect requests', 'formal argument and source stance'], pronunciation: ['front-back and rounded-unrounded vowels', 'suffix harmony in connected words', 'word stress and phrase grouping'], discourse: ['non-finite clause linkage', 'evidential stance in narratives', 'structured argument and synthesis'],
  },
  sv: {
    script: 'Latn', writingSystems: ['Swedish Latin alphabet'], wordOrder: ['Verb-second main clauses', 'Subordinate order contrasts'], morphology: ['Mixed analytic and inflectional structure'],
    basics: ['å, ä and ö with Swedish spelling', 'common and neuter core noun phrases', 'basic definite suffixes'], grammar: ['verb-second and inversion', 'adjective and definiteness patterns', 'subordinate negation placement'], verbs: ['verb classes and tense forms', 'auxiliaries and modal constructions', 'passive and non-finite constructions'], nouns: ['common and neuter gender', 'plural and definite suffixes'], agreement: ['adjective gender and number', 'verbs do not agree with person'], determiners: ['articles plus definiteness suffixes by phrase type'], pronouns: ['subject and object forms', 'reflexive possessives'], questions: ['verb-first polar questions and question words'], negation: ['inte with clause-type placement'], register: ['current address conventions without a compulsory T/V template', 'practical request politeness', 'formal written stance'], pronunciation: ['vowel length and consonant quantity', 'vowel contrasts', 'lexical pitch and phrase prosody by variety'], discourse: ['reference and clause linkage', 'opinion and counterargument', 'professional synthesis'],
  },
  vi: {
    script: 'Latn', writingSystems: ['Vietnamese quốc ngữ Latin orthography'], wordOrder: ['SVO', 'Topic-comment patterns'], morphology: ['Predominantly analytic'],
    basics: ['Vietnamese vowel letters and tone marks', 'syllable-based spelling and word recognition', 'core classifiers and address terms'], grammar: ['classifier noun phrases', 'serial and complement constructions', 'topic and information focus'], verbs: ['aspect and temporal particles', 'modal constructions', 'serial verbs and result relations'], nouns: ['classifiers and contextual number', 'no grammatical gender inflection'], agreement: ['no person-number verb conjugation'], determiners: ['demonstratives with classifier phrases'], pronouns: ['kinship and social-role address forms'], questions: ['question particles and in-situ question words'], negation: ['không, chưa and other construction-sensitive negatives'], register: ['relationship-sensitive address', 'polite request particles', 'formal written versus conversational expression'], pronunciation: ['lexical tones by selected variety', 'vowel and final-consonant contrasts', 'tone and phrase interaction'], discourse: ['reference through address and topic', 'narrative aspect and sequencing', 'formal argument and mediation'], caveats: ['Regional tone and pronunciation systems must be identified rather than merged into one mandatory accent.'],
  },
  th: {
    script: 'Thai', writingSystems: ['Thai abugida'], wordOrder: ['SVO', 'Topic-comment patterns'], morphology: ['Predominantly analytic'],
    basics: ['Thai consonant classes and vowel signs', 'tone-mark and syllable conventions', 'word segmentation without obligatory spaces'], grammar: ['classifier noun phrases', 'serial verbs and complements', 'topic and constituent relations'], verbs: ['aspect and temporal particles', 'modal and serial constructions', 'completion and experience expressions'], nouns: ['classifiers and contextual number', 'no grammatical gender declension'], agreement: ['no person-number verb agreement'], determiners: ['demonstratives and classifier phrases'], pronouns: ['socially conditioned reference and omission'], questions: ['question particles and in-situ question words'], negation: ['ไม่, ยังไม่ and construction-sensitive negation'], register: ['polite particles in speaker and context-sensitive use', 'appropriate address forms', 'formal and conversational registers'], pronunciation: ['lexical tones', 'vowel length', 'initial and final consonant contrasts'], discourse: ['topic continuity and omitted reference', 'serial sequencing and explanation', 'genre-sensitive argument'],
  },
  el: {
    script: 'Grek', writingSystems: ['Modern Greek alphabet'], wordOrder: ['SVO with discourse variation', 'Contextual subject omission'], morphology: ['Fusional case and verbal inflection'],
    basics: ['Greek letters and accent marks', 'core gender and case phrases', 'everyday written forms'], grammar: ['case-governed arguments', 'clitic placement and reference', 'relative and complement clauses'], verbs: ['person and tense forms', 'perfective and imperfective aspect', 'mood and modal constructions'], nouns: ['three grammatical genders', 'case and number'], agreement: ['gender, case and number concord'], determiners: ['definite and indefinite articles'], pronouns: ['strong and weak forms'], questions: ['interrogative words and intonation'], negation: ['δεν and μη(ν) by construction'], register: ['familiar and respectful address', 'polite requests', 'formal argument and lexical register'], pronunciation: ['stress and vowel stability', 'fricative contrasts', 'consonant clusters and phrase grouping'], discourse: ['aspect in narration', 'reference and clause linkage', 'argument and synthesis'],
  },
  cs: {
    script: 'Latn', writingSystems: ['Czech Latin alphabet'], wordOrder: ['SVO with information-structural flexibility'], morphology: ['Fusional case and aspect-rich verbal structure'],
    basics: ['Czech diacritics and vowel length', 'core case and gender patterns', 'basic noun-adjective phrases'], grammar: ['case government and prepositions', 'clitic position in clauses', 'topic, focus and relative clauses'], verbs: ['person and past agreement', 'perfective and imperfective aspect', 'conditional and modal constructions'], nouns: ['seven-case system', 'gender, animacy and number'], agreement: ['gender, number and case concord'], determiners: ['demonstratives and quantifiers', 'no English article paradigm'], pronouns: ['case forms and subject omission'], questions: ['interrogative phrases and intonation'], negation: ['ne- and negative concord'], register: ['ty and vy', 'standard and colloquial variation', 'formal written argument'], pronunciation: ['vowel quantity', 'palatal and postalveolar contrasts', 'consonant clusters and stress'], discourse: ['aspect in narrative', 'information structure', 'argument and reported viewpoint'],
  },
  ro: {
    script: 'Latn', writingSystems: ['Romanian Latin alphabet'], wordOrder: ['SVO with discourse variation', 'Contextual subject omission'], morphology: ['Fusional with postposed definite article'],
    basics: ['Romanian diacritics', 'gender and core article forms', 'basic noun-adjective phrases'], grammar: ['definiteness and noun-phrase agreement', 'case relations and prepositions', 'clitics and subordinate clauses'], verbs: ['person and tense forms', 'subjunctive and modal constructions', 'aspectual and conditional expression'], nouns: ['masculine, feminine and neuter agreement patterns', 'case and number contrasts'], agreement: ['noun-adjective and subject-verb concord'], determiners: ['postposed definite article', 'indefinite and demonstrative forms'], pronouns: ['clitic and strong forms', 'contextual subject omission'], questions: ['interrogative words and intonation'], negation: ['nu and negative concord'], register: ['familiar and respectful address', 'courteous requests', 'formal written stance'], pronunciation: ['central vowels and spelling', 'stress', 'consonant and diphthong contrasts'], discourse: ['reference and temporal sequencing', 'clause linkage', 'argument and synthesis'],
  },
  hu: {
    script: 'Latn', writingSystems: ['Hungarian Latin alphabet'], wordOrder: ['Information-structural order with preverbal focus'], morphology: ['Agglutinative with vowel harmony'],
    basics: ['Hungarian vowel length and digraphs', 'suffix boundaries and harmony', 'core case-marked phrases'], grammar: ['case relations and postpositions', 'focus and verb-prefix placement', 'relative and complement clauses'], verbs: ['definite and indefinite conjugation', 'tense and mood suffixes', 'verbal prefixes and aspectual meaning'], nouns: ['case and possessive suffixes', 'no grammatical gender'], agreement: ['person and possessive agreement', 'verb conjugation conditioned by object definiteness'], determiners: ['definite and indefinite articles'], pronouns: ['personal and demonstrative forms', 'address alternatives'], questions: ['question words in focus', 'polar-question intonation'], negation: ['nem and ne by construction'], register: ['familiar and respectful address forms', 'request conventions', 'formal academic stance'], pronunciation: ['vowel and consonant length', 'front-back vowel harmony', 'initial stress and phrase focus'], discourse: ['focus-sensitive interpretation', 'narrative and argument', 'precise synthesis'],
  },
  da: {
    script: 'Latn', writingSystems: ['Danish Latin alphabet'], wordOrder: ['Verb-second main clauses', 'Subordinate order contrasts'], morphology: ['Mixed analytic and inflectional structure'],
    basics: ['æ, ø and å in Danish spelling', 'common and neuter noun phrases', 'definite suffixes'], grammar: ['verb-second and inversion', 'adjective agreement and definiteness', 'subordinate clause structure'], verbs: ['tense forms and auxiliaries', 'modal and infinitive constructions', 'passive constructions'], nouns: ['common and neuter gender', 'plural and definite marking'], agreement: ['adjective gender and number', 'no person agreement on verbs'], determiners: ['articles and definiteness suffixes'], pronouns: ['subject and object forms', 'reflexive possession'], questions: ['verb-first and question-word clauses'], negation: ['ikke and clause-sensitive position'], register: ['contemporary address conventions', 'indirect practical requests', 'formal written style'], pronunciation: ['vowel contrasts and reductions', 'stød where relevant', 'connected speech and syllable reduction'], discourse: ['clause linkage', 'opinion and narrative coherence', 'professional argument and synthesis'],
  },
  fi: {
    script: 'Latn', writingSystems: ['Finnish Latin alphabet'], wordOrder: ['SVO with discourse-sensitive flexibility'], morphology: ['Agglutinative case and verbal morphology'],
    basics: ['Finnish sound-letter correspondence and quantity', 'core case forms', 'vowel harmony in common words'], grammar: ['local cases and postpositions', 'partitive and total-object contrasts', 'relative and non-finite constructions'], verbs: ['person and tense forms', 'negative auxiliary constructions', 'mood and non-finite forms'], nouns: ['case and number', 'consonant gradation and stem alternation', 'no grammatical gender'], agreement: ['noun-adjective case and number', 'person agreement on verbs'], determiners: ['demonstratives and quantifiers', 'no English article paradigm'], pronouns: ['personal and demonstrative forms', 'spoken and written variants'], questions: ['-ko/-kö and question words'], negation: ['inflected negative auxiliary'], register: ['standard written and spoken variation', 'practical courtesy', 'formal argument'], pronunciation: ['vowel and consonant quantity', 'vowel harmony', 'initial stress and phrase grouping'], discourse: ['case-marked reference', 'information structure and narrative', 'precise academic synthesis'],
  },
  id: {
    script: 'Latn', writingSystems: ['Indonesian Latin orthography'], wordOrder: ['SVO', 'Topic-sensitive voice alternations'], morphology: ['Affixal morphology with analytic time reference'],
    basics: ['Indonesian spelling and syllable patterns', 'core pronouns and address terms', 'root and affix recognition'], grammar: ['noun modification and demonstratives', 'active and passive voice patterns', 'relative clauses with yang'], verbs: ['meN- and di- constructions', 'aspect and temporal adverbials', 'derivational affixes and valency'], nouns: ['reduplication and contextual number', 'no grammatical gender inflection'], agreement: ['no person-number verb conjugation'], determiners: ['ini, itu and quantifier phrases'], pronouns: ['inclusive and exclusive first-person plural', 'socially appropriate address terms'], questions: ['question words and -kah where appropriate'], negation: ['tidak, bukan and belum'], register: ['formal and conversational forms', 'respectful address', 'professional argument'], pronunciation: ['vowel and consonant distinctions', 'syllable boundaries', 'phrase stress and natural grouping'], discourse: ['topic and voice continuity', 'sequence and causality', 'formal synthesis and stance'],
  },
  nb: {
    script: 'Latn', writingSystems: ['Norwegian Bokmål written standard'], wordOrder: ['Verb-second main clauses', 'Subordinate order contrasts'], morphology: ['Mixed analytic and inflectional structure'],
    basics: ['æ, ø and å in Bokmål spelling', 'noun gender and core definite forms', 'basic written standard conventions'], grammar: ['verb-second and inversion', 'adjective agreement and double definiteness', 'subordinate clause order'], verbs: ['tense forms and auxiliaries', 'modal and infinitive constructions', 'passive constructions'], nouns: ['two- or three-gender choices within Bokmål', 'plural and definite suffixes'], agreement: ['adjective gender and number', 'no person-number verb agreement'], determiners: ['articles and definite noun forms'], pronouns: ['subject and object forms', 'reflexive possession'], questions: ['verb-first and question-word clauses'], negation: ['ikke with clause-sensitive position'], register: ['contemporary address conventions', 'routine courtesy', 'formal written argument'], pronunciation: ['vowel length and consonant quantity', 'lexical pitch where the spoken variety uses it', 'listening to explicitly identified Norwegian varieties'], discourse: ['clause linking', 'argument and reference', 'professional synthesis'], caveats: ['Bokmål is a written standard, not one uniquely prescribed spoken accent; no duplicate no language entry.'],
  },
  uk: {
    script: 'Cyrl', writingSystems: ['Ukrainian Cyrillic alphabet'], wordOrder: ['SVO with information-structural flexibility'], morphology: ['Fusional case and verbal aspect'],
    basics: ['Ukrainian Cyrillic letters and apostrophe', 'core gender and case patterns', 'word stress in familiar items'], grammar: ['case government and prepositions', 'adjective and pronoun concord', 'relative clauses and information focus'], verbs: ['person and past agreement', 'perfective and imperfective aspect', 'future, modal and conditional constructions'], nouns: ['seven-case system including vocative', 'gender, number and animacy'], agreement: ['gender, case and number concord'], determiners: ['demonstratives and quantifiers', 'no English article paradigm'], pronouns: ['case forms', 'ти and ви'], questions: ['interrogative phrases and intonation'], negation: ['не and negative concord'], register: ['familiar and respectful address', 'vocative address in context', 'formal written stance'], pronunciation: ['vowel and consonant contrasts', 'palatalisation and stress', 'euphonic alternations in connected speech'], discourse: ['aspect in narration', 'topic and reference', 'argument and synthesis'],
  },
  ln: {
    script: 'Latn', writingSystems: ['Latin orthography with ɛ and ɔ where used', 'Tone marking when pedagogically justified'], wordOrder: ['Predominantly SVO'], morphology: ['Bantu prefixal and suffixal morphology with variety-dependent reduction'],
    basics: ['Lingala vowel letters including ɛ and ɔ', 'noun-class prefix pairs in familiar vocabulary', 'subject prefixes and lexical tone awareness'], grammar: ['noun-class concord with explicit variety awareness', 'possession and demonstrative reference', 'relative reference and clause linking'], verbs: ['subject prefix and verb-stem structure', 'tense-aspect and tone interactions', 'auxiliary and verb-extension constructions'], nouns: ['noun classes and singular-plural pairings', 'agreement reduction differs between varieties'], agreement: ['noun-class concord with documented variation'], determiners: ['demonstrative and possessive constructions', 'no English article paradigm'], pronouns: ['independent pronouns and subject prefixes'], questions: ['question words and intonation'], negation: ['postposed te with appropriate tone notation'], register: ['familiar and respectful interaction by context', 'standard and spoken variety awareness', 'formal expression without invented purist norms'], pronunciation: ['lexical and grammatical tone practice', 'seven-vowel distinctions where the variety preserves them', 'prenasalised consonants and phrase grouping'], discourse: ['reference with class and pronoun strategies', 'TAM distinctions in narratives', 'argument and explanation in an identified variety'], caveats: ['Standard, Kinshasa and other spoken varieties differ; do not silently impose one concord or tonal analysis on all speakers.'], review: ['All stages: variety and concord choices', 'B2/C1/C2: advanced idioms, academic genres and graded TAM sequencing require Lingala specialist review'], sources: [{ url: 'https://wals.info/languoid/lect/wals_code_lin', scope: 'Lingala identity and grammar bibliography' }, { url: 'https://www.africamuseum.be/sites/default/files/media/docs/research/publications/rmca/online/documents-social-sciences-humanities/D.%20Nurse%20Data%20for%20tense%20and%20aspects%20def.pdf', scope: 'Derek Nurse, C36d Lingala: documented TAM structure and variety-dependent analyses; not CEFR sequencing' }],
  },
  sw: {
    script: 'Latn', writingSystems: ['Standard Swahili Latin orthography'], wordOrder: ['Predominantly SVO'], morphology: ['Agglutinative Bantu verbal and nominal morphology'],
    basics: ['Swahili orthography and syllable patterns', 'noun-class prefix pairs', 'core subject prefixes'], grammar: ['noun-class concord', 'relative constructions', 'object and locative reference'], verbs: ['subject-TAM-object-stem structure', 'negative and affirmative TAM contrasts', 'verb extensions and non-finite forms'], nouns: ['noun classes and number pairings', 'locative class constructions'], agreement: ['class concord across verbs, adjectives and pronouns'], determiners: ['class-sensitive demonstratives and possessives'], pronouns: ['independent and bound subject or object forms'], questions: ['interrogative words and question intonation'], negation: ['negative prefixes and form-specific endings'], register: ['context-sensitive greetings', 'respectful requests', 'standard written and conversational styles'], pronunciation: ['vowel and syllable timing', 'prenasalised consonants', 'word stress and phrase grouping'], discourse: ['class-based reference', 'TAM in connected narration', 'argument and formal synthesis'], review: ['All stages: graded noun-class and TAM distribution', 'C1/C2: advanced register and genre calibration with a Swahili curriculum specialist'],
  },
  wo: {
    script: 'Latn', writingSystems: ['Standard Wolof Latin orthography'], wordOrder: ['Predominantly SVO with focus-conditioned constructions'], morphology: ['Affixal morphology and construction-specific TAM marking'],
    basics: ['Wolof letters and vowel or consonant length', 'noun-class determiners in familiar phrases', 'core subject and focus forms'], grammar: ['noun-class determiner agreement', 'focus constructions', 'relative and complement clauses'], verbs: ['TAM and subject-marker series', 'aspect and focus relationships', 'derivational verb extensions'], nouns: ['noun classes expressed through determiners', 'number and reference constructions'], agreement: ['class-sensitive determiners and relative reference'], determiners: ['class-based definite and indefinite forms'], pronouns: ['subject and focus-related series'], questions: ['question words and focus-sensitive syntax'], negation: ['construction-specific negative forms'], register: ['greeting and relationship conventions', 'courteous request strategies', 'formal versus conversational discourse'], pronunciation: ['vowel and consonant length', 'vowel quality contrasts', 'word and phrase rhythm without invented lexical tone lessons'], discourse: ['focus and reference continuity', 'narrative aspect and clause linking', 'argument and audience-sensitive explanation'], review: ['All stages: focus/TAM series and determiner examples require Wolof specialist review', 'B2/C1/C2: idioms, register, genres and CEFR sequencing not independently validated'],
  },
  ha: {
    script: 'Latn', writingSystems: ['Hausa Boko Latin orthography', 'Ajami only when explicitly selected in a source'], wordOrder: ['Predominantly SVO'], morphology: ['Inflectional and derivational morphology with TAM-pronoun systems'],
    basics: ['Boko letters including implosive or hooked-letter contrasts', 'vowel length and tone awareness', 'gender and core noun forms'], grammar: ['gender and number reference', 'relative and focus constructions', 'possessive and noun-phrase relations'], verbs: ['TAM-specific subject-pronoun series', 'verbal grades and valency', 'aspect and modal distinctions'], nouns: ['masculine and feminine gender', 'plural patterns'], agreement: ['gender and number in pronouns and modifiers where applicable'], determiners: ['demonstratives and definiteness constructions'], pronouns: ['independent and TAM-linked pronominal series'], questions: ['question words and focus relations'], negation: ['TAM-sensitive negative constructions'], register: ['greetings and respectful address', 'pragmatically suitable requests', 'formal and conversational genres'], pronunciation: ['lexical tone', 'vowel length', 'implosive and ejective or glottalised contrasts as applicable'], discourse: ['TAM in narrative', 'focus and contrast', 'formal argument and source-sensitive synthesis'], caveats: ['Boko is the authored script default; do not claim Ajami literacy from Latin-script lessons. Tone and length are often unmarked in ordinary Boko writing.'], review: ['All stages: verbal grades, tone notation and negative paradigms need Hausa specialist review', 'B2/C1/C2: register, idioms and academic genre calibration not independently validated'],
  },
  he: {
    script: 'Hebr', writingSystems: ['Modern Hebrew script', 'Niqqud as an explicit learning scaffold'], wordOrder: ['Predominantly SVO'], morphology: ['Root-and-pattern plus affixal morphology'],
    basics: ['right-to-left letters and final forms', 'vowel-point scaffolding and unpointed recognition', 'core gender and number forms'], grammar: ['construct-state noun phrases', 'definiteness and object marking', 'relative and subordinate clauses'], verbs: ['binyan patterns', 'person and tense inflection', 'voice and modal constructions'], nouns: ['masculine and feminine agreement', 'plural and construct forms'], agreement: ['gender and number concord'], determiners: ['definite prefix ha-', 'demonstratives and construct-state definiteness'], pronouns: ['independent and suffixed forms'], questions: ['interrogative words and intonation'], negation: ['לא, אין and construction-sensitive negatives'], register: ['conversational and formal Modern Hebrew', 'polite requests', 'academic and professional stance'], pronunciation: ['vowels with and without pointing', 'stress', 'consonant contrasts by contemporary variety'], discourse: ['reference and relative clauses', 'argument and clause linking', 'formal synthesis and implicit meaning'],
  },
  'zh-Hant': {
    script: 'Hant', writingSystems: ['Traditional Chinese characters', 'Explicitly identified Mandarin romanisation scaffold'], wordOrder: ['SVO', 'Topic-comment structures'], morphology: ['Predominantly analytic; no person-tense verb conjugation'],
    basics: ['traditional character components and stroke conventions', 'Mandarin syllables and lexical tones with chosen scaffold', 'core numerals and measure words'], grammar: ['topic-comment and word order', 'classifiers and noun modification with 的', 'complements and 把 or 被 constructions in context'], verbs: ['aspect particles 了, 過 and 著', 'modal and resultative constructions', 'time reference through context and adverbials'], nouns: ['classifiers', 'number is not a universal noun inflection'], agreement: ['no person or gender verb agreement'], determiners: ['demonstrative-classifier phrases', 'no English article paradigm'], pronouns: ['personal pronouns and contextual omission'], questions: ['嗎, A-not-A and in-situ question words'], negation: ['不 and 沒 in context'], register: ['respectful forms and address terms', 'spoken and formal written expression', 'regional lexical conventions explicitly identified'], pronunciation: ['Mandarin lexical tones and neutral tone by variety', 'tone changes in connected speech', 'syllable initials and finals'], discourse: ['topic chains and omitted reference', 'aspectual narrative cohesion', 'formal connectors and compressed written discourse'], caveats: ['Traditional script is not a distinct spoken language; this authored profile is Mandarin-oriented and does not silently assert Cantonese coverage. Regional vocabulary must be identified.'],
  },
  bn: {
    script: 'Beng', writingSystems: ['Bengali script'], wordOrder: ['Predominantly SOV', 'Postpositions'], morphology: ['Inflectional and agglutinative patterns'],
    basics: ['Bengali letters, vowel signs and conjuncts', 'core classifiers and case-marked phrases', 'everyday number and address forms'], grammar: ['postpositions and case relations', 'classifier and noun phrases', 'relative-correlative constructions'], verbs: ['person and respect-sensitive verb forms', 'tense-aspect constructions', 'non-finite and modal constructions'], nouns: ['case and number or classifier constructions', 'no grammatical gender agreement'], agreement: ['verb person and honorific distinctions rather than grammatical gender'], determiners: ['demonstratives and classifiers', 'no English article paradigm'], pronouns: ['respect-sensitive personal forms'], questions: ['question words and polar-question particles'], negation: ['না, নেই and construction-sensitive negatives'], register: ['তুই, তুমি and আপনি in appropriate relationships', 'courteous requests', 'formal versus conversational genres'], pronunciation: ['vowel and consonant contrasts', 'aspiration', 'conjuncts and connected phrase delivery'], discourse: ['reference and clause chaining', 'temporal narration', 'argument and formal synthesis'],
  },
};

function stageTargets(seed: ProfileSeed): Record<CefrLevel, LanguageCurriculumStageTargets> {
  const forStage = (stage: CefrLevel): LanguageCurriculumStageTargets => {
    const early = stage === 'A1' || stage === 'A2';
    // Do not leak an advanced seed into a beginner blueprint merely because
    // it occupies slot three. Questions/negation have their own real language
    // structures; an A1 request never becomes an academic argument.
    const anchors: Record<LanguageCurriculumTargetFamily, readonly string[]> = {
      basics: seed.basics,
      grammar: stage === 'A1'
        ? [seed.grammar[0], seed.questions[0], seed.negation[0]]
        : stage === 'A2' ? [seed.grammar[0], seed.verbs[1], seed.questions[0]] : seed.grammar,
      morphology: stage === 'A1'
        ? [seed.verbs[0], seed.negation[0], seed.verbs[0]]
        : stage === 'A2' ? [seed.verbs[0], seed.verbs[1], seed.agreement[0]] : seed.verbs,
      pronunciation: seed.pronunciation,
      register: early ? [seed.register[0], seed.register[0], seed.register[1]] : seed.register,
      discourse: early ? [seed.discourse[0], seed.discourse[0], seed.discourse[0]] : seed.discourse,
    };
    const targets = (family: LanguageCurriculumTargetFamily) => STAGE_TASKS[stage][family]
      .map((task, index) => `${task}: ${anchors[family][index]}.`);
    return {
      basics: targets('basics'), grammar: targets('grammar'), morphology: targets('morphology'),
      pronunciation: targets('pronunciation'), register: targets('register'), discourse: targets('discourse'),
    };
  };
  return { A1: forStage('A1'), A2: forStage('A2'), B1: forStage('B1'), B2: forStage('B2'), C1: forStage('C1'), C2: forStage('C2') };
}

function createProfile(languageCode: SupportedLanguageCode): LanguageCurriculumProfile {
  const seed = SEEDS[languageCode];
  return {
    languageId: languageCode, languageCode,
    script: seed.script, direction: SUPPORTED_LANGUAGES[languageCode].rtl ? 'rtl' : 'ltr',
    writingSystems: [...seed.writingSystems],
    pronunciationMetadataReference: `language-oral-capability:${languageCode}`,
    wordOrder: [...seed.wordOrder], morphology: [...seed.morphology],
    verbSystem: [...seed.verbs], nounSystem: [...seed.nouns], agreement: [...seed.agreement],
    determiners: [...seed.determiners], pronouns: [...seed.pronouns], questions: [...seed.questions],
    negation: [...seed.negation], register: [...seed.register],
    learnerDifficulties: [...seed.basics, ...seed.grammar, ...seed.pronunciation],
    pragmatics: [...seed.register, 'Pragmatic choices depend on speaker, recipient, purpose and community; do not teach national stereotypes.'],
    stageTargets: stageTargets(seed),
    reviewStatus: 'NEEDS_LINGUISTIC_REVIEW', supportStatus: 'AUTHORED_NOT_EXPERT_VALIDATED',
    reviewSections: [
      'A1/A2/B1/B2/C1/C2: authored grammar-to-stage sequencing and task sufficiency require expert curriculum review; not official CEFR Reference Level Descriptions.',
      'All stages: runtime examples, idioms and assessment items require language-quality review; structural coverage is not human linguistic validation.',
      ...(seed.review ?? []),
    ],
    sources: [
      { url: 'https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions', scope: 'Six language-independent communicative stages; not a grammar syllabus or external certification of these authored targets' },
      { url: 'https://wals.info/languoid', scope: 'Primary typological reference catalogue and grammar bibliography; not a claim that every target has been individually verified against a reference grammar' },
      ...(seed.sources ?? []),
    ],
    varietyNotes: seed.caveats ? [...seed.caveats] : ['Do not silently treat one regional, social or spoken variety as the only valid language.'],
  };
}

export const LANGUAGE_CURRICULUM_PROFILES: Record<SupportedLanguageCode, LanguageCurriculumProfile> =
  Object.fromEntries(SUPPORTED_LANGUAGE_CODES.map((code) => [code, createProfile(code)])) as Record<SupportedLanguageCode, LanguageCurriculumProfile>;

export function getLanguageCurriculumProfile(code: SupportedLanguageCode): LanguageCurriculumProfile {
  return LANGUAGE_CURRICULUM_PROFILES[code];
}
