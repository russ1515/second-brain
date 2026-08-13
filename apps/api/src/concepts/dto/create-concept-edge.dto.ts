import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type {
  ConceptRelation,
  CreateConceptEdgeRequest,
} from '@second-brain/shared';

export class CreateConceptEdgeDto implements CreateConceptEdgeRequest {
  @IsString()
  @IsNotEmpty()
  targetConceptId!: string;

  @IsIn(['prerequisite', 'related'])
  relation!: ConceptRelation;
}
