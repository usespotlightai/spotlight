import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  InvalidSigningSecretError,
  SIGNING_SECRET_RULE,
} from '@shared-kernel/domain/exceptions/invalid-signing-secret.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const PREFIX = 'whsec_';

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const MIN_BYTES = 24;

const MAX_BYTES = 64;

const REDACTED = '[secret]';

export { SIGNING_SECRET_RULE };

// A Standard Webhooks signing secret: whsec_ and base64 random bytes, which signs an outgoing call.
export class SigningSecret implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(raw: string): SigningSecret {
    if (!SigningSecret.isWellFormed(raw)) {
      throw new InvalidSigningSecretError();
    }

    return new SigningSecret(raw);
  }

  static rehydrate(stored: string): SigningSecret {
    if (!SigningSecret.isWellFormed(stored)) {
      throw new InconsistentStateError(
        'signing secret',
        'is in a shape that cannot sign',
      );
    }

    return new SigningSecret(stored);
  }

  static isWellFormed(raw: string): boolean {
    const encoded = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : '';
    const bytes = BASE64.test(encoded)
      ? Buffer.from(encoded, 'base64').length
      : 0;

    return bytes >= MIN_BYTES && bytes <= MAX_BYTES;
  }

  get [SECRET](): true {
    return true;
  }

  // The HMAC key: the bytes after the prefix.
  get key(): Buffer {
    return Buffer.from(this.#value.slice(PREFIX.length), 'base64');
  }

  revealed(): string {
    return this.#value;
  }

  equals(other: SigningSecret): boolean {
    return this.#value === other.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `SigningSecret ${REDACTED}`;
  }
}
