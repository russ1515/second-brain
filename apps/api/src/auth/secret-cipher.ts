import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Authenticated symmetric encryption (AES-256-GCM) for secrets that must be
 * recoverable at rest — currently TOTP shared secrets. A DB leak alone cannot
 * reveal them without the key. The 32-byte key is derived (SHA-256) from
 * `TWO_FACTOR_ENC_KEY`, falling back to the access secret when unset.
 */
@Injectable()
export class SecretCipher {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const material =
      config.get<string>('auth.twoFactorEncKey') ??
      config.getOrThrow<string>('auth.accessSecret');
    this.key = createHash('sha256').update(material).digest();
  }

  /** Encrypt UTF-8 plaintext → `iv.tag.ciphertext` (all base64). */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, ciphertext].map((b) => b.toString('base64')).join('.');
  }

  /** Inverse of {@link encrypt}. Throws if the payload was tampered with. */
  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Malformed encrypted payload.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
