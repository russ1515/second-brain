import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { AiOrchestratorView } from '@second-brain/shared';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AdminGuard } from '../admin/admin.guard';
import { CapabilityGuard } from '../admin/capability.guard';
import { RequireAdminCapabilities } from '../admin/admin-rbac';
import { AdminStepUpGuard } from '../admin/step-up.guard';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { SetAiStrategyDto } from './dto/set-ai-strategy.dto';

/** AI Infrastructure Manager (Sprint 10.6). Admin-only: view the provider
 *  catalog + per-strategy selection + usage, and change the orchestration
 *  strategy live. */
@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@Controller('ai/orchestrator')
export class AiOrchestratorController {
  constructor(private readonly orchestrator: AiOrchestratorService) {}

  @Get()
  @RequireAdminCapabilities('infrastructure.read')
  view(): AiOrchestratorView {
    return this.orchestrator.view();
  }

  @Put('strategy')
  @RequireAdminCapabilities('settings.manage')
  @UseGuards(AdminStepUpGuard)
  setStrategy(@Body() dto: SetAiStrategyDto): AiOrchestratorView {
    this.orchestrator.setStrategy(dto.strategy);
    return this.orchestrator.view();
  }
}
