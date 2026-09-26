import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AdminReasonDto } from './admin.dto';

/** A deliberately short-lived, human-reviewed private-beta grant. */
export class GrantPrivateBetaAccessDto extends AdminReasonDto {
  @IsDateString()
  expiresAt!: string;
}

/** A distinct revoke DTO keeps the audit reason out of paths and query strings. */
export class RevokePrivateBetaAccessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
