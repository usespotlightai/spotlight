import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Written into the envelope so a key that is rotated later can be told from
 * one that was never right. Nothing reads a version it does not know.
 */
const VERSION = 'v1';

/**
 * A secret at rest. AES-256-GCM, so a row that has been edited in the
 * database fails to open rather than opening as something else.
 *
 * The key belongs to the deployment, not to a workspace: it is what turns a
 * stolen database into rows nobody can read, and it is the one thing here
 * that must not be in the database.
 */
export class SecretCipher {
  private readonly key: Buffer;

  constructor(key: string) {
    const given = Buffer.from(key, 'base64');

    if (given.length !== KEY_BYTES) {
      throw new Error(
        `The secrets key must be ${KEY_BYTES} bytes, base64 encoded. Generate one with: openssl rand -base64 32`,
      );
    }

    this.key = given;
  }

  /** `v1.<iv>.<tag>.<secret>`, each part base64, which is what a row holds. */
  seal(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const sealed = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);

    return [
      VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      sealed.toString('base64'),
    ].join('.');
  }

  open(envelope: string): string {
    const [version, iv, tag, sealed] = envelope.split('.');

    // The sealed part may be empty where the secret was; the envelope around
    // it may not. Reading emptiness as a missing envelope would have this
    // refuse to open something it had sealed itself.
    if (version !== VERSION || !iv || !tag || sealed === undefined) {
      throw new Error('That secret was not sealed by this Spotlight');
    }

    const given = Buffer.from(tag, 'base64');

    if (given.length !== TAG_BYTES) {
      throw new Error('That secret has been tampered with');
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'base64'),
    );

    decipher.setAuthTag(given);

    return Buffer.concat([
      decipher.update(Buffer.from(sealed, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Whether two envelopes hold the same secret, without opening either where
   * they are the same length. Used to leave a row alone when nothing changed.
   */
  static same(one: string, other: string): boolean {
    const left = Buffer.from(one);
    const right = Buffer.from(other);

    return left.length === right.length && timingSafeEqual(left, right);
  }
}
