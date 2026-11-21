import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SANDBOX_VALUE_MIN_LENGTH } from '@secrets/domain/value-objects/secret-sandbox.vo';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const MAX_BYTES = 64 * 1024;

const REDACTED = '[secret]';

export class SecretValue implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(raw: string, field = 'valueWo'): SecretValue {
    if (raw.length === 0) {
      throw new InvalidSecretError(field, 'must not be empty');
    }

    if (new TextEncoder().encode(raw).length > MAX_BYTES) {
      throw new InvalidSecretError(field, `must be at most ${MAX_BYTES} bytes`);
    }

    return new SecretValue(raw);
  }

  get [SECRET](): true {
    return true;
  }

  get fitsOneLine(): boolean {
    return !/[\r\n\0]/.test(this.#value);
  }

  get fitsSandbox(): boolean {
    return (
      !this.#value.includes('\0') &&
      Array.from(this.#value.replace(/\p{White_Space}/gu, '')).length >=
        SANDBOX_VALUE_MIN_LENGTH
    );
  }

  revealed(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `SecretValue ${REDACTED}`;
  }
}
