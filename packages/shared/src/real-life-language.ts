import type { ExperienceSession } from './experience-session';
import type { CefrLevel, ImmersionIntensity, LanguageCorrectionIntensity } from './language';
import type { ActionDestination, NextBestAction } from './next-best-action';
import type { SupportedLanguageCode } from './languages';
import type { TutorMessageView } from './tutor';

/**
 * Real Life Language Engine (RLLE)
 *
 * Product-level orchestration contracts only. RLLE coordinates the existing
 * lesson, Tutor, voice, vocabulary/FSRS and ExperienceSession engines; it is
 * deliberately not a second pedagogical or spaced-repetition engine.
 */

export const RLLE_CURRICULUM_STRANDS = [
  'vocabulary',
  'verbs',
  'conjugation',
  'grammar',
  'listening',
  'reading',
  'conversation',
  'interaction',
  'pronunciation',
  'writing',
  'mediation',
] as const;
export type RlleCurriculumStrand = (typeof RLLE_CURRICULUM_STRANDS)[number];

export const RLLE_GOAL_DOMAINS = ['general', 'travel', 'work', 'studies', 'social'] as const;
export type RlleGoalDomain = (typeof RLLE_GOAL_DOMAINS)[number];

export const RLLE_MISSION_CATEGORIES = ['travel', 'work', 'studies', 'social'] as const;
export type RlleMissionCategory = (typeof RLLE_MISSION_CATEGORIES)[number];

export const RLLE_GAP_KINDS = [
  'vocabulary',
  'grammar',
  'conjugation',
  'listening',
  'fluency',
  'formulation',
  'interaction',
  'pronunciation',
] as const;
export type RlleGapKind = (typeof RLLE_GAP_KINDS)[number];

export const RLLE_LESSON_STAGES = [
  'communicative-objective',
  'vocabulary',
  'grammar-verbs',
  'example',
  'comprehension',
  'practice',
  'oral',
  'writing',
  'verification',
  'review',
] as const;
export type RlleLessonStageKind = (typeof RLLE_LESSON_STAGES)[number];

export const RLLE_REPAIR_STAGES = [
  'explain',
  'guided-practice',
  'retry-now',
  'reuse-later',
  'consolidate',
] as const;
export type RlleRepairStage = (typeof RLLE_REPAIR_STAGES)[number];

export const RLLE_SURVIVAL_SKILLS = [
  'ask-repeat',
  'ask-slow-down',
  'ask-definition',
  'rephrase',
  'check-understanding',
  'explain-unknown-word',
  'buy-thinking-time',
] as const;
export type RlleSurvivalSkill = (typeof RLLE_SURVIVAL_SKILLS)[number];

export interface RlleLevelEvidence {
  level: CefrLevel;
  evidenceCount: number;
  measuredAt: string;
  source: 'placement' | 'assessment' | 'controlled-activity';
}

export interface RlleLevelState {
  declared: CefrLevel;
  estimated: RlleLevelEvidence | null;
  evaluated: RlleLevelEvidence | null;
  target: CefrLevel;
}

export interface RlleCurriculumUnitTemplate {
  id: string;
  level: CefrLevel;
  order: number;
  titleCode: string;
  objectiveCode: string;
  strands: readonly RlleCurriculumStrand[];
  goalDomains: readonly RlleGoalDomain[];
  missionIds: readonly string[];
  canDoIds: readonly string[];
}

export type RlleUnitStatus = 'locked' | 'available' | 'in-progress' | 'completed';

export interface RlleCurriculumUnit extends RlleCurriculumUnitTemplate {
  status: RlleUnitStatus;
  priority: 'core' | 'goal';
  completedLessonIds: string[];
  currentLessonId: string | null;
  lastActivityAt: string | null;
}

export interface RlleLessonStage {
  kind: RlleLessonStageKind;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  /** Stable i18n key, never generated user-facing copy. */
  labelCode: string;
  productionId?: string;
}

export interface RlleLessonOutline {
  id: string;
  unitId: string;
  level: CefrLevel;
  title: string;
  communicativeObjective: string;
  stages: RlleLessonStage[];
  lessonId: string | null;
  experienceSessionId: string;
  status: 'active' | 'paused' | 'completed';
  lastActivityAt: string;
}

export interface RlleWorldMissionTemplate {
  id: string;
  category: RlleMissionCategory;
  minimumLevel: CefrLevel;
  titleCode: string;
  objectiveCode: string;
  strands: readonly RlleCurriculumStrand[];
  survivalSkills: readonly RlleSurvivalSkill[];
  canDoIds: readonly string[];
}

export interface RlleWorldMissionAttempt {
  missionId: string;
  experienceSessionId: string;
  status: 'active' | 'paused' | 'succeeded' | 'needs-retry';
  /** A communicative task is successful only when an evaluator records proof. */
  evidenceIds: string[];
  observedGapIds: string[];
  startedAt: string;
  completedAt: string | null;
}

export type RlleEvidenceSource = 'mission' | 'assessment' | 'controlled-activity';

export interface RlleCapabilityEvidence {
  id: string;
  canDoId: string;
  source: RlleEvidenceSource;
  sourceId: string;
  result: 'demonstrated' | 'not-demonstrated';
  observedAt: string;
  /** What was actually observed; never hidden model reasoning. */
  observation: string;
  /** Dimensions this exact activity could observe. Missing means unknown, not
   * all strands declared by the surrounding mission. */
  dimensions?: RlleProgressDimension[];
}

export interface RlleCanDoTemplate {
  id: string;
  category: RlleMissionCategory;
  minimumLevel: CefrLevel;
  labelCode: string;
}

export interface RlleCanDoCapability extends RlleCanDoTemplate {
  status: 'not-evaluated' | 'in-progress' | 'validated';
  evidence: RlleCapabilityEvidence[];
  validatedAt: string | null;
}

export interface RlleFunctionalGap {
  id: string;
  kind: RlleGapKind;
  status: 'observed' | 'repeated' | 'confirmed' | 'repairing' | 'consolidated';
  label: string;
  evidenceIds: string[];
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface RlleMistakeMemoryItem {
  id: string;
  gapId: string;
  pattern: string;
  /** The exact learner fragment, bounded by the API. */
  learnerExample: string;
  correction: string;
  occurrenceCount: number;
  sourceSessionIds: string[];
  lastObservedAt: string;
  repairStage: RlleRepairStage;
}

export interface RlleRepairLoop {
  mistakeId: string;
  currentStage: RlleRepairStage;
  completedStages: RlleRepairStage[];
  microLessonId: string | null;
  retryEvidenceId: string | null;
  reviewCardIds: string[];
}

export const RLLE_PROGRESS_DIMENSIONS = [
  'vocabulary',
  'grammar',
  'conversation',
  'listening',
  'reading',
  'writing',
  'interaction',
  'pronunciation',
  'mediation',
] as const;
export type RlleProgressDimension = (typeof RLLE_PROGRESS_DIMENSIONS)[number];

export const RLLE_ASSESSMENT_MODALITIES = [
  'listening',
  'reading',
  'speaking',
  'interaction',
  'writing',
  'mediation',
] as const;
export type RlleAssessmentModality = (typeof RLLE_ASSESSMENT_MODALITIES)[number];

export interface RlleAssessmentPart {
  modality: RlleAssessmentModality;
  status: 'pending' | 'active' | 'completed';
  evidenceId: string | null;
}

export interface RlleAssessment {
  id: string;
  targetLevel: CefrLevel;
  status: 'active' | 'completed';
  parts: RlleAssessmentPart[];
  /** Null until all required controlled parts produce sufficient evidence. */
  evaluatedLevel: RlleLevelEvidence | null;
  startedAt: string;
  completedAt: string | null;
}

export interface RlleDimensionProgress {
  dimension: RlleProgressDimension;
  status: 'not-evaluated' | 'emerging' | 'demonstrated' | 'consistent';
  evidenceCount: number;
  lastEvidenceAt: string | null;
}

export interface RlleCourseProgress {
  completedUnits: number;
  totalUnits: number;
  /** Derived only from completedUnits / totalUnits. */
  percent: number | null;
  dimensions: RlleDimensionProgress[];
}

export interface RlleCourseView {
  profileId: string;
  languageCode: SupportedLanguageCode;
  level: RlleLevelState;
  goal: string | null;
  goalDomain: RlleGoalDomain;
  immersionIntensity: ImmersionIntensity;
  correctionIntensity: LanguageCorrectionIntensity;
  status: 'not-started' | 'active' | 'paused' | 'completed';
  units: RlleCurriculumUnit[];
  currentLesson: RlleLessonOutline | null;
  currentMission: RlleWorldMissionAttempt | null;
  canDoMap: RlleCanDoCapability[];
  gaps: RlleFunctionalGap[];
  mistakeMemory: RlleMistakeMemoryItem[];
  repairLoops: RlleRepairLoop[];
  latestAssessment: RlleAssessment | null;
  progress: RlleCourseProgress;
  experienceSession: ExperienceSession | null;
  nextBestAction: NextBestAction | null;
  lastActivityAt: string | null;
}

export interface StartRlleCourseRequest {
  startFrom: 'zero' | 'declared-level';
  targetLevel?: CefrLevel;
  goalDomain?: RlleGoalDomain;
  goal?: string;
  immersionIntensity?: ImmersionIntensity;
  correctionIntensity?: LanguageCorrectionIntensity;
  idempotencyKey?: string;
}

export interface StartRlleLessonRequest {
  unitId?: string;
  lessonId?: string;
  inputModality?: 'text' | 'voice' | 'mixed';
  idempotencyKey?: string;
}

export interface UpdateRlleCoursePreferencesRequest {
  immersionIntensity?: ImmersionIntensity;
  correctionIntensity?: LanguageCorrectionIntensity;
}

export interface StartRlleMissionRequest {
  missionId: string;
  inputModality?: 'text' | 'voice' | 'mixed';
  idempotencyKey?: string;
}

export interface StartRlleAssessmentRequest {
  targetLevel: CefrLevel;
  modalities?: RlleAssessmentModality[];
  idempotencyKey?: string;
}

export interface CompleteRlleLessonRequest {
  experienceSessionId: string;
  /** Only stages the server actually persisted as completed. */
  completedStages: RlleLessonStageKind[];
  controlledEvidence?: RecordRlleEvidenceRequest[];
}

export interface RlleMissionTurnRequest {
  experienceSessionId: string;
  message: string;
  viaVoice?: boolean;
}

export interface RlleMissionEvaluation {
  outcome: 'continue' | 'needs-repair' | 'demonstrated';
  observation: string;
  gap: null | {
    kind: RlleGapKind;
    label: string;
    correction: string;
  };
  microLesson: null | {
    explanation: string;
    example: string;
    practicePrompt: string;
  };
}

export interface RlleMissionTurnResponse {
  message: TutorMessageView;
  evaluation: RlleMissionEvaluation | null;
  course: RlleCourseView;
  missionSession: ExperienceSession;
}

export interface RecordRlleEvidenceRequest {
  canDoId: string;
  source: RlleEvidenceSource;
  sourceId: string;
  result: 'demonstrated' | 'not-demonstrated';
  observation: string;
  gap?: {
    kind: RlleGapKind;
    label: string;
    learnerExample?: string;
    correction?: string;
  };
}

export interface RlleSessionResponse {
  course: RlleCourseView;
  session: ExperienceSession;
  destination: ActionDestination;
}

export const RLLE_DEMO_STAGES = [
  'goal',
  'course',
  'mission',
  'conversation',
  'gap',
  'micro-lesson',
  'retry',
  'vocabulary',
  'review',
  'functional-progress',
] as const;
export type RlleDemoStage = (typeof RLLE_DEMO_STAGES)[number];

/**
 * Stable scenario data for a future faithful product demonstration. It is a
 * blueprint, not fake user progress: Lot 12 can bind each stage to live or
 * explicitly-labelled sample evidence without changing the RLLE vocabulary.
 */
export const RLLE_LANDING_DEMO_BLUEPRINT = {
  objectiveCode: 'rlle.demo.objectiveInternationalWork',
  languageCode: 'en',
  level: 'B1',
  missionId: 'work-meeting',
  stages: RLLE_DEMO_STAGES,
} as const satisfies {
  objectiveCode: string;
  languageCode: SupportedLanguageCode;
  level: CefrLevel;
  missionId: string;
  stages: readonly RlleDemoStage[];
};

const CORE: readonly RlleGoalDomain[] = ['general', 'travel', 'work', 'studies', 'social'];

/** A complete CEFR spine. Goal personalisation changes priority, never removes core units. */
export const RLLE_CURRICULUM: readonly RlleCurriculumUnitTemplate[] = [
  { id: 'a1-first-contact', level: 'A1', order: 10, titleCode: 'rlle.unit.a1FirstContact', objectiveCode: 'rlle.objective.a1FirstContact', strands: ['vocabulary', 'verbs', 'grammar', 'conversation', 'pronunciation'], goalDomains: CORE, missionIds: ['social-introduction'], canDoIds: ['social-introduce'] },
  { id: 'a1-daily-needs', level: 'A1', order: 20, titleCode: 'rlle.unit.a1DailyNeeds', objectiveCode: 'rlle.objective.a1DailyNeeds', strands: ['vocabulary', 'conjugation', 'listening', 'interaction'], goalDomains: CORE, missionIds: ['travel-restaurant', 'travel-directions'], canDoIds: ['travel-order', 'travel-directions'] },
  { id: 'a1-survival', level: 'A1', order: 30, titleCode: 'rlle.unit.a1Survival', objectiveCode: 'rlle.objective.a1Survival', strands: ['listening', 'conversation', 'interaction', 'mediation'], goalDomains: CORE, missionIds: ['travel-hotel', 'social-chat'], canDoIds: ['travel-hotel-problem', 'social-clarify'] },
  { id: 'a2-routines', level: 'A2', order: 40, titleCode: 'rlle.unit.a2Routines', objectiveCode: 'rlle.objective.a2Routines', strands: ['vocabulary', 'verbs', 'conjugation', 'reading', 'writing', 'listening', 'interaction'], goalDomains: CORE, missionIds: ['social-invitation', 'social-chat'], canDoIds: ['social-invite', 'social-clarify'] },
  { id: 'a2-past-plans', level: 'A2', order: 50, titleCode: 'rlle.unit.a2PastPlans', objectiveCode: 'rlle.objective.a2PastPlans', strands: ['conjugation', 'grammar', 'conversation', 'listening'], goalDomains: CORE, missionIds: ['social-story'], canDoIds: ['social-tell-story'] },
  { id: 'a2-travel-study', level: 'A2', order: 60, titleCode: 'rlle.unit.a2TravelStudy', objectiveCode: 'rlle.objective.a2TravelStudy', strands: ['interaction', 'listening', 'reading', 'writing', 'mediation'], goalDomains: ['travel', 'studies', 'general'], missionIds: ['travel-transport', 'travel-airport', 'studies-administration', 'studies-teacher'], canDoIds: ['travel-transport', 'studies-request'] },
  { id: 'b1-experiences', level: 'B1', order: 70, titleCode: 'rlle.unit.b1Experiences', objectiveCode: 'rlle.objective.b1Experiences', strands: ['vocabulary', 'conjugation', 'conversation', 'writing'], goalDomains: CORE, missionIds: ['social-story'], canDoIds: ['social-tell-story'] },
  { id: 'b1-work-travel', level: 'B1', order: 80, titleCode: 'rlle.unit.b1WorkTravel', objectiveCode: 'rlle.objective.b1WorkTravel', strands: ['listening', 'interaction', 'conversation', 'pronunciation', 'mediation'], goalDomains: ['work', 'travel', 'general'], missionIds: ['work-meeting', 'work-interview', 'travel-emergency'], canDoIds: ['work-meeting', 'work-interview', 'travel-emergency'] },
  { id: 'b1-opinions', level: 'B1', order: 90, titleCode: 'rlle.unit.b1Opinions', objectiveCode: 'rlle.objective.b1Opinions', strands: ['grammar', 'listening', 'reading', 'conversation', 'writing', 'mediation'], goalDomains: CORE, missionIds: ['social-debate', 'studies-discussion', 'studies-lecture'], canDoIds: ['social-defend-opinion', 'studies-discuss', 'studies-follow-lecture'] },
  { id: 'b2-collaboration', level: 'B2', order: 100, titleCode: 'rlle.unit.b2Collaboration', objectiveCode: 'rlle.objective.b2Collaboration', strands: ['listening', 'interaction', 'conversation', 'pronunciation'], goalDomains: ['work', 'studies', 'general'], missionIds: ['work-negotiation', 'studies-presentation'], canDoIds: ['work-negotiate', 'studies-present'] },
  { id: 'b2-argument', level: 'B2', order: 110, titleCode: 'rlle.unit.b2Argument', objectiveCode: 'rlle.objective.b2Argument', strands: ['grammar', 'reading', 'writing', 'mediation'], goalDomains: CORE, missionIds: ['social-debate'], canDoIds: ['social-defend-opinion'] },
  { id: 'b2-professional', level: 'B2', order: 120, titleCode: 'rlle.unit.b2Professional', objectiveCode: 'rlle.objective.b2Professional', strands: ['vocabulary', 'verbs', 'writing', 'interaction'], goalDomains: ['work', 'studies'], missionIds: ['work-email', 'work-presentation'], canDoIds: ['work-email', 'work-present'] },
  { id: 'c1-complex-input', level: 'C1', order: 130, titleCode: 'rlle.unit.c1ComplexInput', objectiveCode: 'rlle.objective.c1ComplexInput', strands: ['listening', 'reading', 'vocabulary', 'mediation'], goalDomains: CORE, missionIds: ['studies-synthesis'], canDoIds: ['studies-synthesise'] },
  { id: 'c1-influence', level: 'C1', order: 140, titleCode: 'rlle.unit.c1Influence', objectiveCode: 'rlle.objective.c1Influence', strands: ['conversation', 'interaction', 'grammar', 'pronunciation'], goalDomains: ['work', 'studies', 'social'], missionIds: ['work-negotiation'], canDoIds: ['work-negotiate'] },
  { id: 'c1-production', level: 'C1', order: 150, titleCode: 'rlle.unit.c1Production', objectiveCode: 'rlle.objective.c1Production', strands: ['writing', 'mediation', 'vocabulary', 'grammar'], goalDomains: ['work', 'studies', 'general'], missionIds: ['work-presentation', 'studies-presentation'], canDoIds: ['work-present', 'studies-present'] },
  { id: 'c2-nuance', level: 'C2', order: 160, titleCode: 'rlle.unit.c2Nuance', objectiveCode: 'rlle.objective.c2Nuance', strands: ['vocabulary', 'grammar', 'listening', 'reading'], goalDomains: CORE, missionIds: ['social-debate'], canDoIds: ['social-defend-opinion'] },
  { id: 'c2-adaptation', level: 'C2', order: 170, titleCode: 'rlle.unit.c2Adaptation', objectiveCode: 'rlle.objective.c2Adaptation', strands: ['conversation', 'interaction', 'pronunciation', 'mediation'], goalDomains: CORE, missionIds: ['work-negotiation', 'studies-discussion', 'studies-synthesis'], canDoIds: ['work-negotiate', 'studies-synthesise'] },
  { id: 'c2-mastery', level: 'C2', order: 180, titleCode: 'rlle.unit.c2Mastery', objectiveCode: 'rlle.objective.c2Mastery', strands: ['writing', 'mediation', 'conversation', 'interaction'], goalDomains: CORE, missionIds: ['work-presentation'], canDoIds: ['work-present'] },
] as const;

export const RLLE_WORLD_MISSIONS: readonly RlleWorldMissionTemplate[] = [
  { id: 'travel-airport', category: 'travel', minimumLevel: 'A2', titleCode: 'rlle.mission.travelAirport', objectiveCode: 'rlle.missionObjective.travelAirport', strands: ['listening', 'interaction'], survivalSkills: ['ask-repeat', 'check-understanding'], canDoIds: ['travel-transport'] },
  { id: 'travel-hotel', category: 'travel', minimumLevel: 'A1', titleCode: 'rlle.mission.travelHotel', objectiveCode: 'rlle.missionObjective.travelHotel', strands: ['vocabulary', 'interaction'], survivalSkills: ['rephrase'], canDoIds: ['travel-hotel-problem'] },
  { id: 'travel-restaurant', category: 'travel', minimumLevel: 'A1', titleCode: 'rlle.mission.travelRestaurant', objectiveCode: 'rlle.missionObjective.travelRestaurant', strands: ['vocabulary', 'conversation'], survivalSkills: ['ask-definition'], canDoIds: ['travel-order'] },
  { id: 'travel-transport', category: 'travel', minimumLevel: 'A2', titleCode: 'rlle.mission.travelTransport', objectiveCode: 'rlle.missionObjective.travelTransport', strands: ['listening', 'interaction'], survivalSkills: ['ask-slow-down'], canDoIds: ['travel-transport'] },
  { id: 'travel-directions', category: 'travel', minimumLevel: 'A1', titleCode: 'rlle.mission.travelDirections', objectiveCode: 'rlle.missionObjective.travelDirections', strands: ['listening', 'interaction'], survivalSkills: ['check-understanding'], canDoIds: ['travel-directions'] },
  { id: 'travel-emergency', category: 'travel', minimumLevel: 'B1', titleCode: 'rlle.mission.travelEmergency', objectiveCode: 'rlle.missionObjective.travelEmergency', strands: ['conversation', 'interaction'], survivalSkills: ['rephrase', 'check-understanding'], canDoIds: ['travel-emergency'] },
  { id: 'work-interview', category: 'work', minimumLevel: 'B1', titleCode: 'rlle.mission.workInterview', objectiveCode: 'rlle.missionObjective.workInterview', strands: ['conversation', 'pronunciation'], survivalSkills: ['buy-thinking-time', 'rephrase'], canDoIds: ['work-interview'] },
  { id: 'work-meeting', category: 'work', minimumLevel: 'B1', titleCode: 'rlle.mission.workMeeting', objectiveCode: 'rlle.missionObjective.workMeeting', strands: ['listening', 'interaction'], survivalSkills: ['ask-repeat', 'check-understanding'], canDoIds: ['work-meeting'] },
  { id: 'work-presentation', category: 'work', minimumLevel: 'B2', titleCode: 'rlle.mission.workPresentation', objectiveCode: 'rlle.missionObjective.workPresentation', strands: ['conversation', 'pronunciation'], survivalSkills: ['rephrase'], canDoIds: ['work-present'] },
  { id: 'work-email', category: 'work', minimumLevel: 'B1', titleCode: 'rlle.mission.workEmail', objectiveCode: 'rlle.missionObjective.workEmail', strands: ['reading', 'writing'], survivalSkills: [], canDoIds: ['work-email'] },
  { id: 'work-negotiation', category: 'work', minimumLevel: 'B2', titleCode: 'rlle.mission.workNegotiation', objectiveCode: 'rlle.missionObjective.workNegotiation', strands: ['interaction', 'mediation'], survivalSkills: ['rephrase', 'buy-thinking-time'], canDoIds: ['work-negotiate'] },
  { id: 'studies-lecture', category: 'studies', minimumLevel: 'B1', titleCode: 'rlle.mission.studiesLecture', objectiveCode: 'rlle.missionObjective.studiesLecture', strands: ['listening', 'mediation'], survivalSkills: ['ask-definition', 'explain-unknown-word'], canDoIds: ['studies-follow-lecture'] },
  { id: 'studies-synthesis', category: 'studies', minimumLevel: 'C1', titleCode: 'rlle.mission.studiesSynthesis', objectiveCode: 'rlle.missionObjective.studiesSynthesis', strands: ['listening', 'reading', 'mediation'], survivalSkills: ['ask-definition', 'explain-unknown-word'], canDoIds: ['studies-synthesise'] },
  { id: 'studies-presentation', category: 'studies', minimumLevel: 'B2', titleCode: 'rlle.mission.studiesPresentation', objectiveCode: 'rlle.missionObjective.studiesPresentation', strands: ['writing', 'conversation'], survivalSkills: ['rephrase'], canDoIds: ['studies-present'] },
  { id: 'studies-discussion', category: 'studies', minimumLevel: 'B1', titleCode: 'rlle.mission.studiesDiscussion', objectiveCode: 'rlle.missionObjective.studiesDiscussion', strands: ['interaction', 'mediation'], survivalSkills: ['check-understanding'], canDoIds: ['studies-discuss'] },
  { id: 'studies-teacher', category: 'studies', minimumLevel: 'A2', titleCode: 'rlle.mission.studiesTeacher', objectiveCode: 'rlle.missionObjective.studiesTeacher', strands: ['conversation', 'interaction'], survivalSkills: ['ask-slow-down', 'ask-definition'], canDoIds: ['studies-request'] },
  { id: 'studies-administration', category: 'studies', minimumLevel: 'A2', titleCode: 'rlle.mission.studiesAdministration', objectiveCode: 'rlle.missionObjective.studiesAdministration', strands: ['reading', 'interaction'], survivalSkills: ['check-understanding'], canDoIds: ['studies-request'] },
  { id: 'social-introduction', category: 'social', minimumLevel: 'A1', titleCode: 'rlle.mission.socialIntroduction', objectiveCode: 'rlle.missionObjective.socialIntroduction', strands: ['conversation', 'pronunciation'], survivalSkills: ['buy-thinking-time'], canDoIds: ['social-introduce'] },
  { id: 'social-chat', category: 'social', minimumLevel: 'A1', titleCode: 'rlle.mission.socialChat', objectiveCode: 'rlle.missionObjective.socialChat', strands: ['listening', 'interaction'], survivalSkills: ['ask-repeat'], canDoIds: ['social-clarify'] },
  { id: 'social-story', category: 'social', minimumLevel: 'A2', titleCode: 'rlle.mission.socialStory', objectiveCode: 'rlle.missionObjective.socialStory', strands: ['conjugation', 'conversation'], survivalSkills: ['buy-thinking-time'], canDoIds: ['social-tell-story'] },
  { id: 'social-invitation', category: 'social', minimumLevel: 'A2', titleCode: 'rlle.mission.socialInvitation', objectiveCode: 'rlle.missionObjective.socialInvitation', strands: ['conversation', 'writing'], survivalSkills: ['rephrase'], canDoIds: ['social-invite'] },
  { id: 'social-debate', category: 'social', minimumLevel: 'B1', titleCode: 'rlle.mission.socialDebate', objectiveCode: 'rlle.missionObjective.socialDebate', strands: ['interaction', 'mediation'], survivalSkills: ['rephrase', 'buy-thinking-time'], canDoIds: ['social-defend-opinion'] },
] as const;

export const RLLE_CAN_DO_MAP: readonly RlleCanDoTemplate[] = [
  { id: 'travel-order', category: 'travel', minimumLevel: 'A1', labelCode: 'rlle.canDo.travelOrder' },
  { id: 'travel-directions', category: 'travel', minimumLevel: 'A1', labelCode: 'rlle.canDo.travelDirections' },
  { id: 'travel-hotel-problem', category: 'travel', minimumLevel: 'A1', labelCode: 'rlle.canDo.travelHotelProblem' },
  { id: 'travel-transport', category: 'travel', minimumLevel: 'A2', labelCode: 'rlle.canDo.travelTransport' },
  { id: 'travel-emergency', category: 'travel', minimumLevel: 'B1', labelCode: 'rlle.canDo.travelEmergency' },
  { id: 'work-interview', category: 'work', minimumLevel: 'B1', labelCode: 'rlle.canDo.workInterview' },
  { id: 'work-meeting', category: 'work', minimumLevel: 'B1', labelCode: 'rlle.canDo.workMeeting' },
  { id: 'work-present', category: 'work', minimumLevel: 'B2', labelCode: 'rlle.canDo.workPresent' },
  { id: 'work-email', category: 'work', minimumLevel: 'B1', labelCode: 'rlle.canDo.workEmail' },
  { id: 'work-negotiate', category: 'work', minimumLevel: 'B2', labelCode: 'rlle.canDo.workNegotiate' },
  { id: 'studies-request', category: 'studies', minimumLevel: 'A2', labelCode: 'rlle.canDo.studiesRequest' },
  { id: 'studies-follow-lecture', category: 'studies', minimumLevel: 'B1', labelCode: 'rlle.canDo.studiesFollowLecture' },
  { id: 'studies-discuss', category: 'studies', minimumLevel: 'B1', labelCode: 'rlle.canDo.studiesDiscuss' },
  { id: 'studies-present', category: 'studies', minimumLevel: 'B2', labelCode: 'rlle.canDo.studiesPresent' },
  { id: 'studies-synthesise', category: 'studies', minimumLevel: 'C1', labelCode: 'rlle.canDo.studiesSynthesise' },
  { id: 'social-introduce', category: 'social', minimumLevel: 'A1', labelCode: 'rlle.canDo.socialIntroduce' },
  { id: 'social-clarify', category: 'social', minimumLevel: 'A1', labelCode: 'rlle.canDo.socialClarify' },
  { id: 'social-invite', category: 'social', minimumLevel: 'A2', labelCode: 'rlle.canDo.socialInvite' },
  { id: 'social-tell-story', category: 'social', minimumLevel: 'A2', labelCode: 'rlle.canDo.socialTellStory' },
  { id: 'social-defend-opinion', category: 'social', minimumLevel: 'B1', labelCode: 'rlle.canDo.socialDefendOpinion' },
] as const;

const CEFR_INDEX: Record<CefrLevel, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

export function isCefrAtLeast(level: CefrLevel, minimum: CefrLevel): boolean {
  return CEFR_INDEX[level] >= CEFR_INDEX[minimum];
}

export function nextCefrLevel(level: CefrLevel): CefrLevel {
  const levels: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  return levels[Math.min(levels.length - 1, CEFR_INDEX[level] + 1)];
}

/** Adaptive default only; the learner can override it for every course/session. */
export function defaultImmersionForLevel(level: CefrLevel): ImmersionIntensity {
  if (level === 'A1' || level === 'A2') return 'guided';
  if (level === 'B1' || level === 'B2') return 'mixed';
  return 'full';
}

/** Keep the full pedagogical spine while marking units related to the real goal. */
export function curriculumForGoal(
  startLevel: CefrLevel,
  targetLevel: CefrLevel,
  goalDomain: RlleGoalDomain,
): Array<RlleCurriculumUnitTemplate & { priority: 'core' | 'goal' }> {
  const from = CEFR_INDEX[startLevel];
  // A target below the current starting point never creates a backwards course.
  const to = Math.max(from, CEFR_INDEX[targetLevel]);
  return RLLE_CURRICULUM
    .filter((unit) => CEFR_INDEX[unit.level] >= from && CEFR_INDEX[unit.level] <= to)
    .map((unit) => ({
      ...unit,
      priority:
        goalDomain !== 'general' &&
        unit.goalDomains.length < CORE.length &&
        unit.goalDomains.includes(goalDomain)
          ? 'goal'
          : 'core',
    }));
}

/** Completing a lesson is not proof. Only demonstrated task evidence validates a Can-Do. */
export function canDoStatus(evidence: readonly RlleCapabilityEvidence[]): RlleCanDoCapability['status'] {
  if (evidence.some((item) => item.result === 'demonstrated')) return 'validated';
  return evidence.length > 0 ? 'in-progress' : 'not-evaluated';
}

export function measuredCoursePercent(completedUnits: number, totalUnits: number): number | null {
  if (!Number.isFinite(totalUnits) || totalUnits <= 0) return null;
  const boundedCompleted = Math.min(Math.max(0, completedUnits), totalUnits);
  return Math.round((boundedCompleted / totalUnits) * 100);
}
