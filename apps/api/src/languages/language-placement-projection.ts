import {
  LANGUAGE_PLACEMENT_POLICY_VERSION,
  LANGUAGE_PLACEMENT_REQUIRED_SKILLS,
  LANGUAGE_PLACEMENT_SELF_ESTIMATES,
  highestDemonstratedPlacementLevel,
  placementProductLevel,
  projectLanguagePlacementRound,
  type LanguagePlacementRound,
  type LanguagePlacementSkillEvidence,
  type LanguagePlacementView,
  type LanguagePlacementSummary,
} from '@second-brain/shared';
import type { PrismaService } from '../prisma/prisma.service';

export type { LanguagePlacementSummary } from '@second-brain/shared';

export interface PlacementSessionRow {
  id: string;
  userId: string;
  languageProfileId: string | null;
  currentStep: unknown;
}

/** One bounded relation per profile; no module importing the LanguageModule is
 * required just to read the existing Passport or profile. */
export const placementSessionsInclude = {
  where: { type: 'language' as const, intent: 'language-placement' },
  orderBy: { updatedAt: 'desc' as const }, take: 1,
  select: { id: true, userId: true, languageProfileId: true, currentStep: true },
};

/** Read-only projection from canonical persisted answers/results. The cached
 * global level and session status are deliberately not used as evidence. */
export async function projectLanguagePlacementSummaries(
  prisma: PrismaService,
  userId: string,
  profiles: readonly { id: string; experienceSessions?: PlacementSessionRow[] }[],
): Promise<Map<string, LanguagePlacementSummary>> {
  const sessions = profiles.flatMap((profile) => (profile.experienceSessions ?? [])
    .filter((session) => session.userId === userId && session.languageProfileId === profile.id)
    .map((session) => ({ profileId: profile.id, session, state: record(record(record(session.currentStep)?.metadata)?.languagePlacement) })));
  const assessmentIds = [...new Set(sessions.flatMap(({ state }) => Object.values(record(state?.assessmentIds) ?? {})
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200)))];
  const submissions = assessmentIds.length ? await prisma.assessmentSubmission.findMany({
    where: { userId, assessmentId: { in: assessmentIds }, masteryGenerationStatus: 'ready',
      masterySubmissionKey: { startsWith: 'language-placement:' } },
    include: { assessment: true }, orderBy: { createdAt: 'desc' }, take: assessmentIds.length,
  }) : [];
  const output = new Map<string, LanguagePlacementSummary>();
  for (const { profileId, session, state } of sessions) {
    if (state?.schemaVersion !== 1 || state.policyVersion !== LANGUAGE_PLACEMENT_POLICY_VERSION || state.profileId !== profileId) continue;
    const summary: LanguagePlacementSummary = { policyVersion: LANGUAGE_PLACEMENT_POLICY_VERSION,
      status: 'active', globalLevel: null, productLevel: null, completedAt: null,
      round: 1, skills: [], oralStatus: 'NOT_EVALUATED', nextAction: 'COMPLETE_WRITTEN_DIAGNOSTIC',
      selfEstimate: (LANGUAGE_PLACEMENT_SELF_ESTIMATES as readonly unknown[]).includes(state.selfEstimate)
        ? state.selfEstimate as LanguagePlacementSummary['selfEstimate'] : null };
    let bestConsensus: LanguagePlacementView['globalLevel'] = null;
    for (let round = 1; round <= 3; round += 1) {
      const assessmentId = record(state.assessmentIds)?.[round];
      if (typeof assessmentId !== 'string') break;
      summary.round = round as LanguagePlacementRound;
      const submission = submissions.find((item) => item.assessmentId === assessmentId
        && item.userId === userId && item.masterySubmissionKey === `language-placement:${assessmentId}`);
      if (!submission) break;
      const payload = record(submission.assessment.questions);
      const scope = record(payload?.languagePlacement);
      const questions = Array.isArray(payload?.questions) ? payload.questions.map(record) : [];
      const results = Array.isArray(submission.results) ? submission.results.map(record) : [];
      const answers = Array.isArray(submission.answers) ? submission.answers : [];
      if (submission.assessment.userId !== userId || submission.assessment.masteryGenerationStatus !== 'ready'
        || scope?.policyVersion !== LANGUAGE_PLACEMENT_POLICY_VERSION || scope.profileId !== profileId
        || scope.placementSessionId !== session.id || scope.round !== round
        || JSON.stringify(scope.skills) !== JSON.stringify(LANGUAGE_PLACEMENT_REQUIRED_SKILLS)
        || questions.length !== 4 || results.length !== 4 || answers.length !== 4) {
        summary.status = 'not_evaluable'; break;
      }
      const skills: LanguagePlacementSkillEvidence[] = questions.map((question, index) => {
        const matched = results.filter((item) => item?.questionId === question?.id);
        const observed = matched.length === 1 ? record(matched[0]?.placement) : null;
        const answer = answers[index];
        const quote = typeof observed?.evidenceQuote === 'string' ? observed.evidenceQuote : '';
        const valid = observed?.skill === LANGUAGE_PLACEMENT_REQUIRED_SKILLS[index]
          && typeof answer === 'string' && (!quote || answer.includes(quote));
        return {
          policyVersion: LANGUAGE_PLACEMENT_POLICY_VERSION, round: round as LanguagePlacementRound,
          skill: LANGUAGE_PLACEMENT_REQUIRED_SKILLS[index],
          level: valid ? observed?.level as LanguagePlacementSkillEvidence['level'] : null,
          reason: typeof observed?.reason === 'string' ? observed.reason : '', evidenceQuote: quote,
          questionId: typeof question?.id === 'string' ? question.id : '', assessmentId,
          submissionId: submission.id, observedAt: submission.createdAt.toISOString(),
        };
      });
      const decision = projectLanguagePlacementRound({ round: round as LanguagePlacementRound, skills });
      summary.skills.push(...skills);
      if (decision.status !== 'complete') { summary.status = 'not_evaluable'; break; }
      bestConsensus = highestDemonstratedPlacementLevel(summary.skills);
      if (!decision.nextRound) {
        summary.status = 'complete'; summary.globalLevel = bestConsensus;
        summary.productLevel = bestConsensus ? placementProductLevel(bestConsensus) : null;
        summary.completedAt = submission.createdAt.toISOString(); break;
      }
      summary.round = decision.nextRound;
    }
    summary.nextAction = summary.status === 'complete' ? 'PREPARE_LEARNING_PATH'
      : summary.status === 'not_evaluable' ? 'REVIEW_DIAGNOSTIC_AVAILABILITY' : 'COMPLETE_WRITTEN_DIAGNOSTIC';
    output.set(profileId, summary);
  }
  return output;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
