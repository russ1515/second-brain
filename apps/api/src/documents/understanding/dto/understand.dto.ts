import { IsIn } from 'class-validator';
import type { UnderstandMode, UnderstandRequest } from '@second-brain/shared';

const MODES: UnderstandMode[] = ['summarize', 'rephrase', 'simplify', 'explain'];

export class UnderstandDto implements UnderstandRequest {
  @IsIn(MODES)
  mode!: UnderstandMode;
}
