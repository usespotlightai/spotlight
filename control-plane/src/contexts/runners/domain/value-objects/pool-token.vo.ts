import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const SHAPE = /^[A-Za-z0-9._~-]{32,255}$/;

const REDACTED = '[secret]';

export class PoolToken implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(raw: string): PoolToken {
    if (!SHAPE.test(raw)) {
      throw new InvalidRunnerPoolError(
        'token',
        'must be 32 to 255 URL-safe characters',
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
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `PoolToken ${REDACTED}`;
  }
}
