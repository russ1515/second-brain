import { IsIn } from 'class-validator';
import type { AiStrategy, SetAiStrategyRequest } from '@second-brain/shared';

const STRATEGIES: AiStrategy[] = ['quality', 'cost', 'speed', 'balanced'];

export class SetAiStrategyDto implements SetAiStrategyRequest {
  @IsIn(STRATEGIES)
  strategy!: AiStrategy;
}
