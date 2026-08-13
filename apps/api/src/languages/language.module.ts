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

/** Language engine (Phase 5, Educational Engine): the professional language
 *  teacher. It orchestrates rather than duplicates — vocabulary is ordinary
 *  FSRS cards (FlashcardsModule), lessons come from LessonService, conversation
 *  from TutorService, pronunciation from the @Global SpeechService. What it adds
 *  is per-language state and the seven teaching modes. */
@Module({
  imports: [TutorModule, LessonModule],
  controllers: [LanguageController],
  providers: [
    LanguageService,
    VocabularyService,
    ConversationService,
    PronunciationService,
    LanguageWritingService,
    LanguageSkillsService,
  ],
  exports: [LanguageService],
})
export class LanguageModule {}
