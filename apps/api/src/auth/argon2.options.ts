import * as argon2 from 'argon2';

/** Argon2id parameters (OWASP-aligned baseline). Argon2id resists both GPU and
 *  side-channel attacks; tune memoryCost upward as hardware allows. Shared by
 *  every hash in the auth layer (passwords, refresh secrets, recovery codes) so
 *  the cost stays consistent. */
export const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};
