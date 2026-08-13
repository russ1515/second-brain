import { Module } from '@nestjs/common';
import { ExaminerController } from './examiner.controller';
import { ExaminerService } from './examiner.service';

/** AI Examiner (Sprint 7.6). Depends only on the LLM seam + Prisma (both global-
 *  ish): it generates and marks assessments, reusing the app-wide "never a bare
 *  grade" correction shape (why/how/errorMade/howToAvoid). */
@Module({
  controllers: [ExaminerController],
  providers: [ExaminerService],
  exports: [ExaminerService],
})
export class ExaminerModule {}
