import { Global, Module } from '@nestjs/common';
import { PluginRegistry } from './plugin.registry';
import { PluginController } from './plugin.controller';

/** Plugin & Extension Engine (Sprint 10 ⭐). @Global so any module can register a
 *  plugin (spaces, connectors, AI engines) at boot without touching the core. */
@Global()
@Module({
  controllers: [PluginController],
  providers: [PluginRegistry],
  exports: [PluginRegistry],
})
export class PluginModule {}
