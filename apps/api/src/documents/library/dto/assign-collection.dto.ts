import { IsOptional, IsString } from 'class-validator';

export class AssignCollectionDto {
  /** The collection to move the document into, or null to remove it from any. */
  @IsOptional()
  @IsString()
  collectionId!: string | null;
}
