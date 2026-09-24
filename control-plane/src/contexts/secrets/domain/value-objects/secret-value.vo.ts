import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const MOST_BYTES = 64 * 1024;

const WITHHELD = '[secret]';

export class SecretValue implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(raw: string, field = 'valueWo'): SecretValue {
    if (raw.length === 0) {
      throw new InvalidSecretError(field, 'is empty; a secret has a value');
    }

    if (Buffer.byteLength(raw, 'utf8') > MOST_BYTES) {
      throw new InvalidSecretError(
        field,
        `is longer than ${MOST_BYTES} bytes, which no credential needs`,
      );
    }

    return new SecretValue(raw);
  }

  get [SECRET](): true {
    return true;
  }

  get fitsOneLine(): boolean {
    return !/[\r\n\0]/.test(this.#value);
  }

  revealed(): string {
    return this.#value;
  }

  toString(): string {
    return WITHHELD;
  }

  toJSON(): string {
    return WITHHELD;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `SecretValue ${WITHHELD}`;
  }
}
