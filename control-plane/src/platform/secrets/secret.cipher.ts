import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

const VERSION = 'v1';

export class UndecryptableSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UndecryptableSecretError';
  }
}

// The key is the deployment's and must never be stored in the database.
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

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);

    return [
      VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  decrypt(envelope: string): string {
    const [version, iv, tag, encrypted] = envelope.split('.');

    if (version !== VERSION || !iv || !tag || encrypted === undefined) {
      throw new UndecryptableSecretError(
        'That secret was not encrypted by this Spotlight',
      );
    }

    const given = Buffer.from(tag, 'base64');

    if (given.length !== TAG_BYTES) {
      throw new UndecryptableSecretError('That secret has been tampered with');
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'base64'),
    );

    decipher.setAuthTag(given);

    try {
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new UndecryptableSecretError(
        'That secret was encrypted with another key, or has been tampered with',
      );
    }
  }
}
