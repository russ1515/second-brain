import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** Schema for required environment variables. Boot fails fast if any is missing/invalid.
 *  Secrets that are only needed at call time (e.g. GEMINI_API_KEY) are optional so the
 *  app can boot and pass health checks without them. */
class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsInt()
  API_PORT!: number;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_HOST!: string;

  @IsInt()
  REDIS_PORT!: number;

  @IsString()
  QDRANT_URL!: string;

  @IsOptional()
  @IsString()
  QDRANT_API_KEY?: string;

  @IsString()
  LLM_PROVIDER!: string;

  @IsString()
  LLM_MODEL!: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  // ── Auth (Phase 1) ──
  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsInt()
  JWT_ACCESS_TTL!: number;

  @IsInt()
  JWT_REFRESH_TTL!: number;

  @IsOptional()
  @IsInt()
  EMAIL_VERIFICATION_TTL?: number;

  @IsOptional()
  @IsString()
  MAIL_TRANSPORT?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  @IsOptional()
  @IsString()
  APP_URL?: string;

  @IsOptional()
  @IsInt()
  TWO_FACTOR_CHALLENGE_TTL?: number;

  @IsOptional()
  @IsString()
  TWO_FACTOR_ENC_KEY?: string;

  @IsOptional()
  @IsString()
  EMBEDDINGS_PROVIDER?: string;

  @IsOptional()
  @IsString()
  EMBEDDINGS_MODEL?: string;

  // ── Speech (Phase 5, voice layer) ──
  @IsOptional()
  @IsString()
  SPEECH_PROVIDER?: string;

  @IsOptional()
  @IsString()
  SPEECH_STT_MODEL?: string;

  @IsOptional()
  @IsString()
  SPEECH_TTS_MODEL?: string;

  @IsOptional()
  @IsString()
  SPEECH_VOICE?: string;

  // ── Daily journey notifications (Phase 5) ──
  @IsOptional()
  @IsString()
  NOTIFY_TRANSPORT?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }

  return validated;
}
