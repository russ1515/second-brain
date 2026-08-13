import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { KnowledgeIntegration } from '@second-brain/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { KnowledgeIntegrationService } from './knowledge-integration.service';

/** Smart Knowledge Integration (Sprint 6.8) — how a document enriched the
 *  learner's digital brain. */
@UseGuards(JwtAccessGuard)
@Controller('library/documents')
export class KnowledgeIntegrationController {
  constructor(private readonly integration: KnowledgeIntegrationService) {}

  /** The integration report: new vs known concepts, links to existing knowledge,
   *  prerequisites, dependents, mastered vs fragile. Graph + twin (no LLM). */
  @Get(':id/integration')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<KnowledgeIntegration> {
    return this.integration.report(user.userId, id);
  }
}
