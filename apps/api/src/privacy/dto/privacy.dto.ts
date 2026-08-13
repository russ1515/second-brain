import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import {
  CONSENT_KEYS,
  type ConsentKey,
  type DeleteAccountRequest,
  type SetConsentRequest,
} from '@second-brain/shared';

export class SetConsentDto implements SetConsentRequest {
  @IsIn(CONSENT_KEYS as readonly string[])
  key!: ConsentKey;

  @IsBoolean()
  granted!: boolean;
}

export class DeleteAccountDto implements DeleteAccountRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
