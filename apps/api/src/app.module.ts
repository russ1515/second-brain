import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QdrantModule } from './qdrant/qdrant.module';
import { LlmModule } from './llm/llm.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { SpeechModule } from './speech/speech.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { DocumentModule } from './documents/document.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { ConceptModule } from './concepts/concept.module';
import { TutorModule } from './tutor/tutor.module';
import { LessonModule } from './lessons/lesson.module';
import { HomeworkModule } from './homework/homework.module';
import { SessionModule } from './sessions/session.module';
import { MemoryModule } from './memory/memory.module';
import { RevisionModule } from './revision/revision.module';
import { PlannerModule } from './planner/planner.module';
import { CalendarModule } from './calendar/calendar.module';
import { SmartNotificationsModule } from './notifications-smart/smart-notifications.module';
import { GoalsModule } from './goals/goals.module';
import { LanguageModule } from './languages/language.module';
import { NotificationModule } from './notifications/notification.module';
import { JourneyModule } from './journey/journey.module';
import { ExaminerModule } from './examiner/examiner.module';
import { LiteracyModule } from './literacy/literacy.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { PaymentsModule } from './payments/payments.module';
import { UsageModule } from './usage/usage.module';
import { OrganizationModule } from './organizations/organization.module';
import { AdminModule } from './admin/admin.module';
import { PrivacyModule } from './privacy/privacy.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { PredictionModule } from './prediction/prediction.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { AiMentorModule } from './ai-mentor/ai-mentor.module';
import { SuccessModule } from './success/success.module';
import { InsightsCenterModule } from './insights-center/insights-center.module';
import { LearningDnaModule } from './learning-dna/learning-dna.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PluginModule } from './plugins/plugin.module';
import { LocalizationModule } from './localization/localization.module';
import { ActivityInterceptor } from './common/activity.interceptor';
import { MentorModule } from './mentor/mentor.module';
import { CoachModule } from './coach/coach.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Root-level .env (monorepo) with a local override fallback.
      envFilePath: ['../../.env', '.env'],
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Drives the daily journey's hourly sweep (JourneyScheduler).
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MonitoringModule,
    PluginModule,
    LocalizationModule,
    OnboardingModule,
    QdrantModule,
    LlmModule,
    EmbeddingsModule,
    SpeechModule,
    MailModule,
    NotificationModule,
    HealthModule,
    AuthModule,
    DocumentModule,
    FlashcardsModule,
    ConceptModule,
    TutorModule,
    LessonModule,
    HomeworkModule,
    SessionModule,
    MemoryModule,
    RevisionModule,
    PlannerModule,
    CalendarModule,
    SmartNotificationsModule,
    GoalsModule,
    LanguageModule,
    MentorModule,
    CoachModule,
    JourneyModule,
    ExaminerModule,
    LiteracyModule,
    SubscriptionModule,
    PaymentsModule,
    UsageModule,
    OrganizationModule,
    AdminModule,
    PrivacyModule,
    IntelligenceModule,
    PredictionModule,
    RecommendationModule,
    AiMentorModule,
    SuccessModule,
    InsightsCenterModule,
    LearningDnaModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      // Analytics activity signal (Sprint 8.6) — stamps lastActiveAt (throttled).
      provide: APP_INTERCEPTOR,
      useClass: ActivityInterceptor,
    },
  ],
})
export class AppModule {}
