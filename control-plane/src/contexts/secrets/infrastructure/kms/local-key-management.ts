import { randomBytes } from 'node:crypto';
import { opened, sealed } from '@secrets/infrastructure/crypto/envelope';
import { boundTo } from '@secrets/infrastructure/crypto/key-context';
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
    const given = Buffer.from(key, 'base64');

    if (given.length !== KEY_BYTES) {
      throw new Error(
        `SPOTLIGHT_SECRETS_KEY must be ${KEY_BYTES} bytes, base64 encoded. Generate one with: openssl rand -base64 32`,
      );
    }

    this.key = given;
  }

  async issue(context: KeyContext): Promise<IssuedDataKey> {
    const plain = randomBytes(KEY_BYTES);

    return {
      plain: new Uint8Array(plain),
      wrapped: sealed(this.key, plain, boundTo(context)),
    };
  }

  async unwrap(wrapped: string, context: KeyContext): Promise<Uint8Array> {
    return new Uint8Array(opened(this.key, wrapped, boundTo(context)));
  }
}
