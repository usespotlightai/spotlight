import { randomBytes } from 'node:crypto';
import { decrypt, encrypt } from '@secrets/infrastructure/crypto/envelope';
import { aadFor } from '@secrets/infrastructure/crypto/key-context';
import type {
  IssuedDataKey,
  KeyContext,
  KeyManagement,
} from '@secrets/infrastructure/kms/key-management';

const KEY_BYTES = 32;

export class LocalKeyManagement implements KeyManagement {
  readonly keyId = 'local';

  private readonly key: Buffer;

  constructor(key: string) {
    const decoded = Buffer.from(key, 'base64');

    if (decoded.length !== KEY_BYTES) {
      throw new Error(
        `SPOTLIGHT_SECRETS_KEY must be ${KEY_BYTES} bytes, base64 encoded. Generate one with: openssl rand -base64 32`,
      );
    }

    this.key = decoded;
  }

  async issue(context: KeyContext): Promise<IssuedDataKey> {
    const plain = randomBytes(KEY_BYTES);

    return {
      plain: new Uint8Array(plain),
      wrapped: encrypt(this.key, plain, aadFor(context)),
    };
  }

  async unwrap(wrapped: string, context: KeyContext): Promise<Uint8Array> {
    return new Uint8Array(decrypt(this.key, wrapped, aadFor(context)));
  }
}
