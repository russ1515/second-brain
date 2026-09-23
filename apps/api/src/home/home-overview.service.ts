import { Injectable } from '@nestjs/common';
import type {
  ActionDestination,
  CalendarEntry,
  CalendarView,
  ExamView,
  ExperienceSession,
  Goal,
  HomeContextView,
  HomeGoalPreview,
  HomeOverview,
  HomeOverviewSource,
  HomeProgressSummary,
  HomeResumableSession,
  HomeSourceState,
  HomeUpcomingItem,
  InitiativeView,
  LearningPredictionView,
  MentorOverview,
  ProactiveBriefing,
  RecommendationFeed,
  ReviewableView,
} from '@second-brain/shared';
import { HOME_OVERVIEW_SOURCES } from '@second-brain/shared';
import { CalendarService } from '../calendar/calendar.service';
import { CoachService } from '../coach/coach.service';
import { ExperienceSessionService } from '../experience-sessions/experience-session.service';
import { ExamsService } from '../goals/exams.service';
import { GoalsService } from '../goals/goals.service';
import { ProactiveService } from '../intelligence/proactive.service';
import { LocalizationService } from '../localization/localization.service';
import {
  NextBestActionAdapter,
  type NextBestActionCandidate,
} from '../recommendation/next-best-action.adapter';
import { RecommendationService } from '../recommendation/recommendation.service';
import { RevisionEngineService } from '../revision/revision-engine.service';
import { MentorService } from '../mentor/mentor.service';
import { PredictionService } from '../prediction/prediction.service';

const SESSION_VALIDITY_MS = 30 * 86_400_000;

/**
 * Read-only Home aggregation. Domain services remain authoritative; this layer
 * only gathers their factual signals, ranks them and shapes a lightweight view.
 */
@Injectable()
export class HomeOverviewService {
  constructor(
    private readonly recommendations: RecommendationService,
    private readonly nba: NextBestActionAdapter,
    private readonly coach: CoachService,
    private readonly initiatives: ProactiveService,
    private readonly foresight: PredictionService,
    private readonly revision: RevisionEngineService,
    private readonly exams: ExamsService,
    private readonly sessions: ExperienceSessionService,
    private readonly goals: GoalsService,
    private readonly calendar: CalendarService,
    private readonly mentor: MentorService,
    private readonly localization: LocalizationService,
  ) {}

  async overview(userId: string, now = new Date()): Promise<HomeOverview> {
    const results = await Promise.allSettled([
      this.recommendations.feed(userId),
      this.coach.today(userId),
      this.initiatives.list(userId),
      this.foresight.forecast(userId, now),
      this.revision.due(userId),
      this.exams.list(userId),
      this.sessions.resumable(userId, 3),
      this.goals.list(userId),
      this.calendar.view(userId),
      this.mentor.overview(userId, now),
    ] as const);

    const [recommendationResult, coachResult, initiativeResult, foresightResult, reviewResult, examResult, sessionResult, goalResult, calendarResult, progressResult] = results;
    const sources = this.sourceStates({
      recommendations: recommendationResult,
      coach: coachResult,
      initiatives: initiativeResult,
      foresight: foresightResult,
      reviews: reviewResult,
      exams: examResult,
      sessions: sessionResult,
      goals: goalResult,
      calendar: calendarResult,
      progress: progressResult,
    });

    const reviews = fulfilled(reviewResult, [] as ReviewableView[]);
    const exams = fulfilled(examResult, [] as ExamView[]).filter((exam) => exam.daysUntil >= 0);
    const rawSessions = fulfilled(sessionResult, { items: [], nextCursor: null }).items;
    const resumableSessions = rawSessions.map((session) => this.toResumableSession(session)).filter(isPresent).slice(0, 3);
    const goals = fulfilled(goalResult, [] as Goal[]);
    const mentor = fulfilled(progressResult, null as MentorOverview | null);
    const coach = fulfilled(coachResult, null as ProactiveBriefing | null);
    const initiatives = fulfilled(initiativeResult, [] as InitiativeView[]);
    const foresight = fulfilled(foresightResult, null as LearningPredictionView | null);
    const feed = fulfilled(recommendationResult, { recommendations: [] } as RecommendationFeed);

    // A known-empty due queue invalidates old persisted review suggestions.
    const currentRecommendations = sources.reviews === 'available' && reviews.length === 0
      ? feed.recommendations.filter((recommendation) => recommendation.kind !== 'review')
      : feed.recommendations;

    const candidates = [
      ...this.examCandidates(exams, now),
      ...this.reviewCandidates(reviews, now),
      ...this.sessionCandidates(resumableSessions, now),
      ...this.coachCandidates(coach, now),
      ...this.initiativeCandidates(initiatives, now),
      ...this.foresightCandidates(foresight, now),
      ...this.nba.candidatesFromRecommendations(currentRecommendations),
      ...this.goalCandidates(goals, now),
    ];

    const completeForEmptyState = ['recommendations', 'reviews', 'exams', 'sessions', 'goals']
      .every((source) => sources[source as HomeOverviewSource] === 'available');
    const hasHistory = this.hasHistory(mentor, rawSessions, goals, currentRecommendations.length);
    let nextBestAction = this.nba.fromCandidates(candidates, now);
    if (!nextBestAction && completeForEmptyState) {
      nextBestAction = this.nba.fromCandidates([
        hasHistory ? this.caughtUpCandidate(now) : this.newUserCandidate(now),
      ], now);
    }

    const mainGoal = this.mainGoal(goals);
    const upcoming = this.upcoming(fulfilled(calendarResult, null as CalendarView | null), exams);
    const progress = this.progress(mentor, reviews);
    const context = this.context(nextBestAction, exams, hasHistory, completeForEmptyState);

    return this.localize(userId, {
      generatedAt: now.toISOString(),
      context,
      nextBestAction,
      resumableSessions,
      mainGoal,
      upcoming,
      progress,
      sources,
      partial: Object.values(sources).some((state) => state === 'unavailable'),
    });
  }

  private examCandidates(exams: readonly ExamView[], now: Date): NextBestActionCandidate[] {
    return exams.filter((exam) => exam.daysUntil <= 30).map((exam) => {
      const preparationSignal = exam.preparation === null ? '' : ` Preparation is ${exam.preparation}%.`;
      return {
        id: exam.id,
        title: `Prepare for ${exam.subject}`,
        actionLabel: 'Prepare now',
        destination: { kind: 'route', path: '/exams', params: { examId: exam.id } },
        reason: exam.daysUntil === 0 ? 'Your exam is today.' : `Your exam is in ${exam.daysUntil} days.`,
        estimatedDuration: null,
        expectedImpact: null,
        signals: [{
          signal: 'exam.deadline',
          humanLabel: 'Upcoming exam',
          evidence: `${exam.subject}: ${exam.daysUntil} day${exam.daysUntil === 1 ? '' : 's'} remaining.${preparationSignal}`,
          source: 'exams',
          timestamp: now.toISOString(),
          weight: this.examPriority(exam),
        }],
        priority: this.examPriority(exam),
        validUntil: new Date(`${exam.date}T23:59:59.999Z`).toISOString(),
        confidence: exam.preparation === null ? null : 1,
        source: { kind: 'goal', id: exam.id },
        dedupeKey: `exam:${exam.id}`,
      };
    });
  }

  private examPriority(exam: ExamView): number {
    const base = exam.daysUntil <= 1 ? 970 : exam.daysUntil <= 7 ? 900 : exam.daysUntil <= 14 ? 760 : 500;
    const declared = exam.priority === 'high' ? 30 : exam.priority === 'medium' ? 15 : 0;
    const preparation = exam.preparation !== null && exam.preparation < 50 ? 10 : 0;
    return base + declared + preparation;
  }

  private reviewCandidates(reviews: readonly ReviewableView[], now: Date): NextBestActionCandidate[] {
    if (reviews.length === 0) return [];
    const urgent = reviews.some((review) => review.priority === 'urgent' || review.urgency === 'overdue');
    const priority = urgent ? 950 : 880;
    return [{
      id: reviews[0].id,
      title: 'Review what is due',
      actionLabel: 'Review now',
      destination: { kind: 'review', path: '/revision' },
      reason: `${reviews.length} review${reviews.length === 1 ? ' is' : 's are'} due now.`,
      estimatedDuration: null,
      expectedImpact: null,
      signals: [{
        signal: 'revision.due',
        humanLabel: urgent ? 'Urgent review' : 'Review due',
        evidence: `${reviews.length} review${reviews.length === 1 ? ' is' : 's are'} due now.`,
        source: 'fsrs',
        timestamp: now.toISOString(),
        weight: priority,
      }],
      priority,
      validUntil: null,
      confidence: 1,
      source: { kind: 'revision', id: reviews[0].id },
      dedupeKey: 'review:due',
    }];
  }

  private sessionCandidates(sessions: readonly HomeResumableSession[], now: Date): NextBestActionCandidate[] {
    return sessions.map((session) => ({
      id: session.id,
      title: session.title ?? 'Resume your learning session',
      actionLabel: 'Resume',
      destination: session.destination,
      reason: 'This session has a saved place to continue from.',
      estimatedDuration: null,
      expectedImpact: { kind: 'continuity', label: 'Continue without losing context' },
      signals: [{
        signal: session.status === 'paused' ? 'session.paused' : 'session.active',
        humanLabel: session.status === 'paused' ? 'Interrupted session' : 'Active session',
        evidence: 'The session has a verified resume destination and preserved context.',
        source: 'experience-sessions',
        timestamp: session.updatedAt,
        weight: session.status === 'paused' ? 820 : 760,
      }],
      priority: session.status === 'paused' ? 820 : 760,
      validUntil: validUntilAfter(session.updatedAt, SESSION_VALIDITY_MS),
      confidence: 1,
      source: { kind: 'session', id: session.id },
      dedupeKey: this.sessionDedupeKey(session),
    }));
  }

  private coachCandidates(coach: ProactiveBriefing | null, now: Date): NextBestActionCandidate[] {
    if (!coach) return [];
    return coach.recommendations.map((recommendation, index) => {
      const destination: ActionDestination = recommendation.kind === 'vocabulary' && recommendation.languageProfileId
        ? { kind: 'language', id: recommendation.languageProfileId, path: `/languages/${recommendation.languageProfileId}` }
        : recommendation.kind === 'review'
          ? { kind: 'review', id: recommendation.conceptId, path: '/revision', params: recommendation.conceptId ? { conceptId: recommendation.conceptId } : undefined }
          : { kind: 'concept', id: recommendation.conceptId, path: '/lesson/new', params: recommendation.conceptId ? { conceptId: recommendation.conceptId, title: recommendation.activity } : { title: recommendation.activity } };
      const dedupeKey = recommendation.conceptId
        ? `concept:${recommendation.conceptId}`
        : recommendation.languageProfileId
          ? `language:${recommendation.languageProfileId}`
          : `${recommendation.kind}:${recommendation.activity.toLocaleLowerCase()}`;
      return {
        title: recommendation.kind === 'lesson' ? `Continue ${recommendation.activity}` : recommendation.kind === 'review' ? `Review ${recommendation.activity}` : `Practice ${recommendation.activity}`,
        actionLabel: recommendation.kind === 'lesson' ? 'Continue' : 'Start',
        destination,
        reason: recommendation.reason,
        estimatedDuration: recommendation.minutes > 0 ? recommendation.minutes : null,
        expectedImpact: null,
        signals: [{
          signal: `coach.${recommendation.kind}`,
          humanLabel: 'Coach recommendation',
          evidence: recommendation.reason,
          source: 'coach',
          timestamp: now.toISOString(),
          weight: 720 - index,
        }],
        priority: 720 - index,
        validUntil: new Date(now.getTime() + 86_400_000).toISOString(),
        confidence: null,
        source: { kind: 'coach' as const },
        dedupeKey,
      };
    });
  }

  private initiativeCandidates(initiatives: readonly InitiativeView[], now: Date): NextBestActionCandidate[] {
    return initiatives.flatMap((initiative) => {
      if (initiative.kind !== 'review_due' && initiative.kind !== 'comeback') return [];
      const review = initiative.kind === 'review_due';
      return [{
        id: initiative.id,
        title: initiative.title,
        actionLabel: review ? 'Review now' : 'Start learning',
        destination: review ? { kind: 'review' as const, path: '/revision' } : { kind: 'route' as const, path: '/learn' },
        reason: initiative.message,
        estimatedDuration: null,
        expectedImpact: null,
        signals: (initiative.reasons.length ? initiative.reasons : [initiative.message]).map((evidence) => ({
          signal: `mentor.${initiative.kind}`,
          humanLabel: 'Mentor suggestion',
          evidence,
          source: 'proactive-mentor',
          timestamp: initiative.createdAt,
          weight: review ? 850 : 650,
        })),
        priority: review ? 850 : 650,
        validUntil: validUntilAfter(initiative.createdAt, 3 * 86_400_000),
        confidence: null,
        source: { kind: 'mentor' as const, id: initiative.id },
        dedupeKey: review ? 'review:due' : 'comeback',
      }];
    });
  }

  private foresightCandidates(view: LearningPredictionView | null, now: Date): NextBestActionCandidate[] {
    const risk = view?.topRisk;
    if (!risk || risk.level === 'low') return [];
    const destination: ActionDestination = risk.kind === 'forgetting'
      ? { kind: 'review', path: '/revision' }
      : risk.kind === 'overload'
        ? { kind: 'route', path: '/calendar' }
        : risk.kind === 'difficulty'
          ? { kind: 'route', path: '/brain' }
          : { kind: 'route', path: '/goals' };
    const probability = Math.max(0, Math.min(100, risk.probability));
    return [{
      id: `foresight:${risk.kind}`,
      title: risk.action,
      actionLabel: 'Adapt my plan',
      destination,
      reason: `At your current pace, the ${risk.kind} risk is estimated at ${probability}%. ${risk.cause}`,
      estimatedDuration: null,
      expectedImpact: null,
      signals: [{
        signal: `foresight.${risk.kind}`,
        humanLabel: 'Foresight estimate',
        evidence: `Estimated probability: ${probability}%. ${risk.reasons.join(' ')}`,
        source: 'foresight',
        timestamp: view.generatedAt,
        weight: risk.level === 'high' ? 740 : 620,
      }],
      priority: risk.level === 'high' ? 740 : 620,
      validUntil: new Date(now.getTime() + 86_400_000).toISOString(),
      confidence: probability / 100,
      source: { kind: 'foresight', id: risk.kind },
      dedupeKey: `foresight:${risk.kind}`,
    }];
  }

  private goalCandidates(goals: readonly Goal[], now: Date): NextBestActionCandidate[] {
    const goal = goals.find((candidate) => candidate.status === 'pending');
    if (!goal) return [];
    return [{
      id: goal.id,
      title: `Continue ${goal.title}`,
      actionLabel: 'View goal',
      destination: { kind: 'route', path: '/goals', params: { goalId: goal.id } },
      reason: `This is your current ${goal.period} goal.`,
      estimatedDuration: null,
      expectedImpact: { kind: 'goal', label: 'Move your goal forward' },
      signals: [{
        signal: 'goal.active',
        humanLabel: 'Active goal',
        evidence: `The goal “${goal.title}” is still in progress.`,
        source: 'goals',
        timestamp: goal.createdAt || now.toISOString(),
        weight: 300,
      }],
      priority: 300,
      validUntil: null,
      confidence: 1,
      source: { kind: 'goal', id: goal.id },
      dedupeKey: `goal:${goal.id}`,
    }];
  }

  private newUserCandidate(now: Date): NextBestActionCandidate {
    return {
      title: 'Start learning',
      actionLabel: 'Start learning',
      destination: { kind: 'route', path: '/learn' },
      reason: 'Second Brain is still getting to know you.',
      signals: [{
        signal: 'profile.insufficient-data',
        humanLabel: 'Getting started',
        evidence: 'No learning activity, review, exam, session or goal is available yet.',
        source: 'home-aggregation',
        timestamp: now.toISOString(),
      }],
      priority: 100,
      source: { kind: 'manual' },
      dedupeKey: 'fallback:new-user',
    };
  }

  private caughtUpCandidate(now: Date): NextBestActionCandidate {
    return {
      title: 'Explore a new subject',
      actionLabel: 'Explore',
      destination: { kind: 'route', path: '/learn' },
      reason: 'Nothing urgent is due right now.',
      signals: [{
        signal: 'status.caught-up',
        humanLabel: 'Up to date',
        evidence: 'No due review, close exam or resumable priority was found.',
        source: 'home-aggregation',
        timestamp: now.toISOString(),
      }],
      priority: 100,
      source: { kind: 'manual' },
      dedupeKey: 'fallback:caught-up',
    };
  }

  private toResumableSession(session: ExperienceSession): HomeResumableSession | null {
    const destination = this.resumeDestination(session);
    if (!destination || (session.status !== 'active' && session.status !== 'paused')) return null;
    const contextLabels = session.activeContexts.items
      .filter((item) => item.visibility !== 'hidden' && item.label)
      .slice(0, 3)
      .map((item) => item.label as string);
    const production = session.productions[0];
    const source = session.sourceReferences[0];
    return {
      id: session.id,
      type: session.type,
      status: session.status,
      title: session.title,
      contextLabels,
      updatedAt: session.updatedAt,
      progress: session.progress,
      artifact: production
        ? { kind: production.kind, id: production.referenceId ?? production.id, title: production.title ?? null }
        : source
          ? { kind: source.kind, id: source.id, title: source.title ?? null }
          : null,
      destination,
    };
  }

  private resumeDestination(session: ExperienceSession): ActionDestination | null {
    if (session.resumeTarget) return session.resumeTarget;
    if (session.links.tutorSessionId) return { kind: 'experience-session', id: session.id, path: `/tutor/${session.links.tutorSessionId}`, params: { experienceSessionId: session.id } };
    if (session.links.studySessionId) return { kind: 'experience-session', id: session.id, path: `/session/${session.links.studySessionId}`, params: { experienceSessionId: session.id } };
    if (session.links.lessonId) return { kind: 'experience-session', id: session.id, path: `/lesson/${session.links.lessonId}`, params: { experienceSessionId: session.id } };
    if (session.links.documentId) return { kind: 'experience-session', id: session.id, path: `/library/${session.links.documentId}`, params: { experienceSessionId: session.id } };
    if (session.links.languageProfileId) return { kind: 'experience-session', id: session.id, path: `/languages/${session.links.languageProfileId}`, params: { experienceSessionId: session.id } };
    if (session.links.workspaceRef) return { kind: 'experience-session', id: session.id, path: `/library/workspace/${session.links.workspaceRef}`, params: { experienceSessionId: session.id } };
    return null;
  }

  private sessionDedupeKey(session: HomeResumableSession): string {
    const destination = session.destination;
    if (destination.kind === 'concept' && destination.id) return `concept:${destination.id}`;
    return `session:${session.id}`;
  }

  private mainGoal(goals: readonly Goal[]): HomeGoalPreview | null {
    const goal = goals.find((candidate) => candidate.status === 'pending');
    return goal ? {
      id: goal.id,
      title: goal.title,
      period: goal.period,
      progress: null,
      destination: { kind: 'route', path: '/goals', params: { goalId: goal.id } },
    } : null;
  }

  private upcoming(calendar: CalendarView | null, exams: readonly ExamView[]): HomeUpcomingItem[] {
    const calendarItems = (calendar?.days ?? []).flatMap((day) => day.entries
      .filter((entry) => entry.id !== 'ai-session-today')
      .map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        date: day.date,
        destination: this.calendarDestination(entry),
      })));
    const examItems: HomeUpcomingItem[] = exams.map((exam) => ({
      id: exam.id,
      kind: 'exam',
      title: exam.subject,
      date: exam.date,
      destination: { kind: 'route', path: '/exams', params: { examId: exam.id } },
    }));
    const unique = new Map<string, HomeUpcomingItem>();
    for (const item of [...calendarItems, ...examItems].sort((a, b) => a.date.localeCompare(b.date))) {
      const key = `${item.date}:${item.kind}:${item.title.trim().toLocaleLowerCase()}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    return [...unique.values()].slice(0, 3);
  }

  private calendarDestination(entry: CalendarEntry): ActionDestination {
    if (entry.kind === 'revision' || entry.kind === 'quiz') return { kind: 'review', path: '/revision' };
    if (entry.kind === 'exam') return { kind: 'route', path: '/exams', params: { entryId: entry.id } };
    if (entry.kind === 'objective' || entry.kind === 'deadline') return { kind: 'route', path: '/goals', params: { entryId: entry.id } };
    if (entry.kind === 'language') return { kind: 'route', path: '/languages', params: { entryId: entry.id } };
    return { kind: 'route', path: '/calendar', params: { entryId: entry.id } };
  }

  private progress(mentor: MentorOverview | null, reviews: readonly ReviewableView[]): HomeProgressSummary | null {
    if (!mentor) return null;
    return {
      reviewsDue: Math.max(mentor.stats.dueNow, reviews.length),
      conceptsAtRisk: mentor.stats.atRiskConcepts,
      conceptsMastered: mentor.stats.conceptsMastered,
      cardsReviewed: mentor.stats.cardsReviewed,
      streakDays: mentor.streak.current,
    };
  }

  private context(
    nba: HomeOverview['nextBestAction'],
    exams: readonly ExamView[],
    hasHistory: boolean,
    completeForEmptyState: boolean,
  ): HomeContextView {
    if (!nba) return { kind: 'active', focusLabel: null };
    if (nba.signalsUsed.some((signal) => signal.signal === 'exam.deadline')) {
      return { kind: 'exam', focusLabel: exams.find((exam) => exam.id === nba.id)?.subject ?? nba.title };
    }
    if (nba.signalsUsed.some((signal) => signal.signal === 'revision.due')) return { kind: 'revision', focusLabel: null };
    if (nba.source.kind === 'session') return { kind: 'resume', focusLabel: nba.title };
    if (nba.source.kind === 'manual' && completeForEmptyState) {
      return { kind: hasHistory ? 'caught-up' : 'new', focusLabel: null };
    }
    return { kind: 'active', focusLabel: nba.title };
  }

  private hasHistory(
    mentor: MentorOverview | null,
    sessions: readonly ExperienceSession[],
    goals: readonly Goal[],
    recommendationCount: number,
  ): boolean {
    if (sessions.length > 0 || goals.length > 0 || recommendationCount > 0) return true;
    if (!mentor) return false;
    return mentor.stats.cardsReviewed > 0
      || mentor.stats.lessonsCompleted > 0
      || mentor.stats.exercisesCorrect > 0
      || mentor.stats.conceptsMastered > 0;
  }

  private sourceStates(results: Record<HomeOverviewSource, PromiseSettledResult<unknown>>): Record<HomeOverviewSource, HomeSourceState> {
    return Object.fromEntries(HOME_OVERVIEW_SOURCES.map((source) => [source, results[source].status === 'fulfilled' ? 'available' : 'unavailable'])) as Record<HomeOverviewSource, HomeSourceState>;
  }

  private async localize(userId: string, overview: HomeOverview): Promise<HomeOverview> {
    const nba = overview.nextBestAction;
    // Session titles and calendar/reviewable titles can be learner-authored. Only
    // translate product copy plus the one calendar aggregate created by us.
    const translateNbaTitle = nba?.source.kind !== 'session';
    const translatableUpcoming = overview.upcoming.filter((item) => item.id.startsWith('cards-'));
    const strings = nba ? [
      ...(translateNbaTitle ? [nba.title] : []),
      nba.primaryAction.label,
      nba.reason,
      ...(nba.expectedImpact ? [nba.expectedImpact.label] : []),
      ...nba.signalsUsed.flatMap((signal) => [signal.humanLabel, signal.evidence]),
      ...translatableUpcoming.map((item) => item.title),
    ] : translatableUpcoming.map((item) => item.title);
    if (strings.length === 0) return overview;
    const translated = await this.localization.localizeForUser(userId, strings);
    let index = 0;
    const nextBestAction = nba ? {
      ...nba,
      title: translateNbaTitle ? translated[index++] : nba.title,
      primaryAction: { ...nba.primaryAction, label: translated[index++] },
      reason: translated[index++],
      expectedImpact: nba.expectedImpact ? { ...nba.expectedImpact, label: translated[index++] } : null,
      signalsUsed: nba.signalsUsed.map((signal) => ({ ...signal, humanLabel: translated[index++], evidence: translated[index++] })),
      alternatives: nba.alternatives,
    } : null;
    return {
      ...overview,
      nextBestAction,
      upcoming: overview.upcoming.map((item) => item.id.startsWith('cards-')
        ? { ...item, title: translated[index++] }
        : item),
    };
  }
}

function fulfilled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function validUntilAfter(value: string, durationMs: number): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp + durationMs).toISOString() : 'invalid';
}
