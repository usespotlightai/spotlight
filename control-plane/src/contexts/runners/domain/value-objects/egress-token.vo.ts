import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const SHAPE = /^[A-Za-z0-9._~-]{32,255}$/;

const REDACTED = '[secret]';

export class EgressToken implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(raw: string): EgressToken {
    if (!SHAPE.test(raw)) {
      throw new InvalidEgressError(
        'token',
        'must be 32 to 255 URL-safe characters',
      );
    }

    return new EgressToken(raw);
  }

  get [SECRET](): true {
    return true;
  }

  revealed(): string {
    return this.#value;
  }

  equals(other: EgressToken): boolean {
    return this.#value === other.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `EgressToken ${REDACTED}`;
  }
}
