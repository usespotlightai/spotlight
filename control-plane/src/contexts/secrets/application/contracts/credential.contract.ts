import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const WITHHELD = '[credential]';

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
    return WITHHELD;
  }

  toJSON(): string {
    return WITHHELD;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `Credential ${WITHHELD}`;
  }
}
