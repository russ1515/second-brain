import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * A Copilot prompt is untrusted user input. It must never become an execution
 * instruction for a database, provider, shell, or deployment action.
 */
export class AdminCopilotQueryDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  query!: string;

  /** Server-generated when omitted. The opaque id is session scoped only. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,128}$/)
  conversationId?: string;
}
