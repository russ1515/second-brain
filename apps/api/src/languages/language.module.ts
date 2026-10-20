import { Module } from '@nestjs/common';
import { LanguageController } from './language.controller';
import { LanguageService } from './language.service';
import { VocabularyService } from './vocabulary.service';
import { ConversationService } from './conversation.service';
import { PronunciationService } from './pronunciation.service';
import { LanguageWritingService } from './language-writing.service';
import { LanguageSkillsService } from './language-skills.service';
import { TutorModule } from '../tutor/tutor.module';
import { LessonModule } from '../lessons/lesson.module';
import { ExperienceSessionModule } from '../experience-sessions/experience-session.module';
import { RealLifeLanguageService } from './real-life-language.service';
import { LearningEvidenceModule } from '../learning-evidence/learning-evidence.module';
import { ExaminerModule } from '../examiner/examiner.module';
import { FeatureFlagsModule } from '../config/feature-flags.module';
import { LanguageMasteryAttemptController } from './language-mastery-attempt.controller';
import { LanguageMasteryAttemptService } from './language-mastery-attempt.service';
import { LanguageAcousticMasteryController } from './language-acoustic-mastery.controller';
import { LanguageAcousticMasteryService } from './language-acoustic-mastery.service';
import { LanguagePlacementService } from './language-placement.service';
import { LanguagePlacementController } from './language-placement.controller';
import { LanguageLearningCoreController } from './language-learning-core.controller';
import { LanguageLearningCoreService } from './language-learning-core.service';

/** Language engine (Phase 5, Educational Engine): the professional language
 *  teacher. It orchestrates rather than duplicates — vocabulary is ordinary
 *  FSRS cards (FlashcardsModule), lessons come from LessonService, conversation
 *  from TutorService, pronunciation from the @Global SpeechService. What it adds
 *  is per-language state and the seven teaching modes. */
@Module({
  imports: [
    TutorModule,
    LessonModule,
    ExperienceSessionModule,
    LearningEvidenceModule,
    ExaminerModule,
    FeatureFlagsModule,
  ],
  controllers: [
    LanguageController,
    LanguageMasteryAttemptController,
    LanguageAcousticMasteryController,
    LanguagePlacementController,
    LanguageLearningCoreController,
  ],
  providers: [
    LanguageService,
    VocabularyService,
    ConversationService,
    PronunciationService,
    LanguageWritingService,
    LanguageSkillsService,
    RealLifeLanguageService,
    LanguageMasteryAttemptService,
    LanguageAcousticMasteryService,
    LanguagePlacementService,
    LanguageLearningCoreService,
  ],
  exports: [LanguageService, RealLifeLanguageService, LanguageMasteryAttemptService],
})
export class LanguageModule {}
