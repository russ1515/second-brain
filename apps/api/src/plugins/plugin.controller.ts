import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PluginCatalog } from '@second-brain/shared';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { PluginRegistry } from './plugin.registry';

/** Plugin & Extension Engine (Sprint 10 ⭐): the capability catalog. */
@UseGuards(JwtAccessGuard)
@Controller('plugins')
export class PluginController {
  constructor(private readonly registry: PluginRegistry) {}

  @Get()
  catalog(): PluginCatalog {
    return this.registry.catalog();
  }
}
