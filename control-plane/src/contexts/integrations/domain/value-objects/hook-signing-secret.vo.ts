import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const PREFIX = 'whsec_';

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const FEWEST_BYTES = 24;

const MOST_BYTES = 64;

const WITHHELD = '[secret]';

export class HookSigningSecret implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(raw: string): HookSigningSecret {
    const encoded = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : '';
    const bytes = BASE64.test(encoded)
      ? Buffer.from(encoded, 'base64').length
      : 0;

    if (bytes < FEWEST_BYTES || bytes > MOST_BYTES) {
      throw new InvalidHookError(
        FieldPath.of(['signing', 'secret']),
        `is whsec_ followed by ${FEWEST_BYTES} to ${MOST_BYTES} base64-encoded random bytes, as Standard Webhooks signing secrets are`,
      );
    }

    return new HookSigningSecret(raw);
  }

  get [SECRET](): true {
    return true;
  }

  get key(): Buffer {
    return Buffer.from(this.#value.slice(PREFIX.length), 'base64');
  }

  revealed(): string {
    return this.#value;
  }

  equals(other: HookSigningSecret): boolean {
    return this.#value === other.#value;
  }

  toString(): string {
    return WITHHELD;
  }

  toJSON(): string {
    return WITHHELD;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `HookSigningSecret ${WITHHELD}`;
  }
}
