import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const REDACTED = '[credential]';

export class Credential implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(plain: string): Credential {
    return new Credential(plain);
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
    return `Credential ${REDACTED}`;
  }
}
