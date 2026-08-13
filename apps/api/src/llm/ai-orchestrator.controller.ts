import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { AiOrchestratorView } from '@second-brain/shared';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AdminGuard } from '../admin/admin.guard';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { SetAiStrategyDto } from './dto/set-ai-strategy.dto';

/** AI Infrastructure Manager (Sprint 10.6). Admin-only: view the provider
 *  catalog + per-strategy selection + usage, and change the orchestration
 *  strategy live. */
@UseGuards(JwtAccessGuard, AdminGuard)
@Controller('ai/orchestrator')
export class AiOrchestratorController {
  constructor(private readonly orchestrator: AiOrchestratorService) {}

  @Get()
  view(): AiOrchestratorView {
    return this.orchestrator.view();
  }

  @Put('strategy')
  setStrategy(@Body() dto: SetAiStrategyDto): AiOrchestratorView {
    this.orchestrator.setStrategy(dto.strategy);
    return this.orchestrator.view();
  }
}
