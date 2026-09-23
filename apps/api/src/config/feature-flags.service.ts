import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UXFeatureFlag, UXFeatureFlags } from '@second-brain/shared';
import { DISABLED_UX_FEATURE_FLAGS } from '@second-brain/shared';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly config: ConfigService) {}

  all(): UXFeatureFlags {
    return this.config.get<UXFeatureFlags>('features') ?? DISABLED_UX_FEATURE_FLAGS;
  }

  enabled(flag: UXFeatureFlag): boolean {
    return this.all()[flag] === true;
  }
}
