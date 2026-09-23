import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type {
  EssayCorrection,
  ExtractVocabularyResponse,
  LanguageDialogue,
  LanguageLessonResponse,
  LanguageMode,
  LanguageProfileDetail,
  LanguageProfileSummary,
  LanguageSkillResponse,
  PronunciationAssessment,
  PronunciationCoaching,
  RlleCanDoCapability,
  RlleCourseView,
  RlleMissionTurnResponse,
  RlleSessionResponse,
  RlleWorldMissionTemplate,
  StartConversationResponse,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LessonService } from '../lessons/lesson.service';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';
import { LanguageService } from './language.service';
import { VocabularyService } from './vocabulary.service';
import { ConversationService } from './conversation.service';
import { PronunciationService } from './pronunciation.service';
import { LanguageWritingService } from './language-writing.service';
import { languageSystemPrompt, modeSpec } from './language-modes';
import { CreateLanguageProfileDto } from './dto/create-language-profile.dto';
import { UpdateLanguageProfileDto } from './dto/update-language-profile.dto';
import { ExtractVocabularyDto } from './dto/extract-vocabulary.dto';
import { GenerateLanguageLessonDto } from './dto/generate-language-lesson.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { GenerateDialogueDto } from './dto/generate-dialogue.dto';
import { CorrectEssayDto } from './dto/correct-essay.dto';
import { LanguageSkillsService } from './language-skills.service';
import { LanguageSkillDto, ConjugationDto } from './dto/language-skill.dto';
import { RealLifeLanguageService } from './real-life-language.service';
import { StartRlleCourseDto } from './dto/start-rlle-course.dto';
import { StartRlleLessonDto } from './dto/start-rlle-lesson.dto';
import { AdvanceRlleLessonDto } from './dto/advance-rlle-lesson.dto';
import { StartRlleMissionDto } from './dto/start-rlle-mission.dto';
import { RlleMissionTurnDto } from './dto/rlle-mission-turn.dto';
import { RecordRlleEvidenceDto } from './dto/record-rlle-evidence.dto';
import { UpdateRlleCoursePreferencesDto } from './dto/update-rlle-course-preferences.dto';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

@UseGuards(JwtAccessGuard)
@Controller('languages')
export class LanguageController {
  constructor(
    private readonly languages: LanguageService,
    private readonly vocabulary: VocabularyService,
    private readonly conversation: ConversationService,
    private readonly pronunciation: PronunciationService,
    private readonly writing: LanguageWritingService,
    private readonly skills: LanguageSkillsService,
    private readonly lessons: LessonService,
    private readonly rlle: RealLifeLanguageService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLanguageProfileDto,
  ): Promise<LanguageProfileSummary> {
    return this.languages.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<LanguageProfileSummary[]> {
    return this.languages.list(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<LanguageProfileDetail> {
    return this.languages.get(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLanguageProfileDto,
  ): Promise<LanguageProfileSummary> {
    return this.languages.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.languages.remove(user.userId, id);
  }

  /** Structured CEFR curriculum and its measured, resumable learner state. */
  @Get(':id/course')
  course(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RlleCourseView> {
    return this.rlle.course(user.userId, id);
  }

  @Post(':id/course/start')
  @HttpCode(HttpStatus.CREATED)
  courseStart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StartRlleCourseDto,
  ): Promise<RlleSessionResponse> {
    return this.rlle.startCourse(user.userId, id, dto);
  }

  @Patch(':id/course/preferences')
  coursePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRlleCoursePreferencesDto,
  ): Promise<RlleCourseView> {
    return this.rlle.updatePreferences(user.userId, id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/course/lessons/start')
  @HttpCode(HttpStatus.CREATED)
  courseLessonStart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StartRlleLessonDto,
  ): Promise<RlleSessionResponse> {
    return this.rlle.startLesson(user.userId, id, dto);
  }

  @Post(':id/course/advance')
  @HttpCode(HttpStatus.OK)
  courseAdvance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdvanceRlleLessonDto,
  ): Promise<RlleCourseView> {
    return this.rlle.advanceLesson(
      user.userId,
      id,
      dto.experienceSessionId,
      dto.lessonId,
      dto.completedStage,
    );
  }

  @Get(':id/missions')
  worldMissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{
    goalDomain: RlleCourseView['goalDomain'];
    items: Array<RlleWorldMissionTemplate & {
      available: boolean;
      priority: 'core' | 'goal';
      attempt: RlleCourseView['currentMission'];
    }>;
  }> {
    return this.rlle.missions(user.userId, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/missions/:missionId/start')
  @HttpCode(HttpStatus.CREATED)
  worldMissionStart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('missionId') missionId: string,
    @Body() dto: StartRlleMissionDto,
  ): Promise<RlleSessionResponse> {
    return this.rlle.startMission(user.userId, id, missionId, dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/missions/:missionId/turn')
  @HttpCode(HttpStatus.OK)
  worldMissionTurn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('missionId') missionId: string,
    @Body() dto: RlleMissionTurnDto,
  ): Promise<RlleMissionTurnResponse> {
    return this.rlle.missionTurn(
      user.userId,
      id,
      missionId,
      dto.experienceSessionId,
      dto.message,
      dto.viaVoice,
    );
  }

  /** Client declarations alone can never validate a Can-Do. */
  @Post(':id/evidence')
  @HttpCode(HttpStatus.OK)
  recordEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordRlleEvidenceDto,
  ): Promise<RlleCourseView> {
    return this.rlle.recordEvidence(user.userId, id, dto);
  }

  @Get(':id/can-do')
  canDoMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RlleCanDoCapability[]> {
    return this.rlle.canDo(user.userId, id);
  }

  /** Mine vocabulary into this language's FSRS deck. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/vocabulary')
  @HttpCode(HttpStatus.CREATED)
  extractVocabulary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ExtractVocabularyDto,
  ): Promise<ExtractVocabularyResponse> {
    return this.vocabulary.extract(user.userId, id, dto);
  }

  /** A full written lesson, pitched at the profile's teaching mode. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/lesson')
  @HttpCode(HttpStatus.CREATED)
  async lesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GenerateLanguageLessonDto,
  ): Promise<LanguageLessonResponse> {
    const profile = await this.languages.requireOwned(user.userId, id);
    const mode = profile.mode as LanguageMode;
    const lesson = await this.lessons.generate(
      user.userId,
      {
        topic: dto.topic,
        language: profile.language,
        level: modeSpec(mode).level,
      },
      {
        languageProfileId: profile.id,
        // The mode's pedagogical contract steers the lesson the same way it
        // steers conversation, so the learner meets one consistent teacher.
        directive: languageSystemPrompt({
          language: profile.language,
          nativeLanguage: profile.nativeLanguage,
          mode,
          goal: profile.goal,
        }),
      },
    );
    return { lesson, mode };
  }

  /** Start immersive conversation practice; continue it via the tutor endpoints. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/conversation')
  @HttpCode(HttpStatus.CREATED)
  async conversationStart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StartConversationDto,
  ): Promise<StartConversationResponse> {
    const session = await this.conversation.start(user.userId, id, dto);
    return { session };
  }

  /** Generate a written dialogue to study in the target language. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/dialogue')
  @HttpCode(HttpStatus.CREATED)
  dialogue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GenerateDialogueDto,
  ): Promise<LanguageDialogue> {
    return this.writing.dialogue(user.userId, id, dto.scenario);
  }

  /** Correct a learner's written text (rédaction) with per-fragment explanations. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/essay')
  @HttpCode(HttpStatus.OK)
  correctEssay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CorrectEssayDto,
  ): Promise<EssayCorrection> {
    return this.writing.correctEssay(user.userId, id, dto.text);
  }

  /** Grammar lesson (Sprint 7.3), pitched to the profile's mode + CEFR level. */
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post(':id/grammar')
  @HttpCode(HttpStatus.OK)
  async grammar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LanguageSkillDto,
  ): Promise<LanguageSkillResponse> {
    const profile = await this.languages.requireOwned(user.userId, id);
    return this.skills.grammar(profile, dto.topic);
  }

  /** Conjugation practice (Sprint 7.3). */
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post(':id/conjugation')
  @HttpCode(HttpStatus.OK)
  async conjugation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConjugationDto,
  ): Promise<LanguageSkillResponse> {
    const profile = await this.languages.requireOwned(user.userId, id);
    return this.skills.conjugation(profile, dto.verb);
  }

  /** Reading / listening comprehension passage + questions (Sprint 7.3). */
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post(':id/comprehension')
  @HttpCode(HttpStatus.OK)
  async comprehension(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LanguageSkillDto,
  ): Promise<LanguageSkillResponse> {
    const profile = await this.languages.requireOwned(user.userId, id);
    return this.skills.reading(profile, dto.topic);
  }

  /** Read a phrase aloud (multipart field `audio`) and have it scored. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/pronounce')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES } }),
  )
  pronounce(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() audio: UploadedFileLike | undefined,
    @Body('targetPhrase') targetPhrase?: string,
  ): Promise<PronunciationAssessment> {
    if (!audio) {
      throw new BadRequestException('No audio was uploaded (field "audio").');
    }
    if (!targetPhrase?.trim()) {
      throw new BadRequestException('A "targetPhrase" field is required.');
    }
    return this.pronunciation.assess(
      user.userId,
      id,
      targetPhrase.trim(),
      audio,
    );
  }

  /** Pronunciation COACH (Sprint 7.5): listen to free speech (multipart field
   *  `audio`) and coach across pronunciation, accent, rhythm, fluency and
   *  intonation — why it matters, how to improve, tailored exercises. */
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post(':id/pronunciation-coach')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES } }),
  )
  pronunciationCoach(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() audio: UploadedFileLike | undefined,
    @Body('context') context?: string,
  ): Promise<PronunciationCoaching> {
    if (!audio) {
      throw new BadRequestException('No audio was uploaded (field "audio").');
    }
    return this.pronunciation.coachSpeaking(user.userId, id, audio, context);
  }
}
