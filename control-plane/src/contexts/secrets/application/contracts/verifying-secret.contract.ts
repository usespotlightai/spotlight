import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const REDACTED = '[secret]';

export class VerifyingSecret implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(value: string): VerifyingSecret {
    return new VerifyingSecret(value);
  }

  get [SECRET](): true {
    return true;
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
    return `VerifyingSecret ${REDACTED}`;
  }
}
