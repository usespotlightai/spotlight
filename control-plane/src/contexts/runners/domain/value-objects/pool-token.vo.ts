import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const SHAPE = /^[A-Za-z0-9._~-]{32,255}$/;

const WITHHELD = '[secret]';

export class PoolToken implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(raw: string): PoolToken {
    if (!SHAPE.test(raw)) {
      throw new InvalidRunnerPoolError(
        'token',
        'is 32 to 255 URL-safe characters, as a generated password would be',
      );
    }

    return new PoolToken(raw);
  }

  get [SECRET](): true {
    return true;
  }

  revealed(): string {
    return this.#value;
  }

  equals(other: PoolToken): boolean {
    return this.#value === other.#value;
  }

  toString(): string {
    return WITHHELD;
  }

  toJSON(): string {
    return WITHHELD;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `PoolToken ${WITHHELD}`;
  }
}
