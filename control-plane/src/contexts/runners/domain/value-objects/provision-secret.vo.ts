import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

const PREFIX = 'whsec_';

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const MIN_BYTES = 24;

const MAX_BYTES = 64;

const WITHHELD = '[secret]';

export class ProvisionSecret implements Secret {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static of(raw: string): ProvisionSecret {
    const encoded = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : '';
    const bytes = BASE64.test(encoded)
      ? Buffer.from(encoded, 'base64').length
      : 0;

    if (bytes < MIN_BYTES || bytes > MAX_BYTES) {
      throw new InvalidRunnerPoolError(
        'provision.secret',
        `must be whsec_ followed by ${MIN_BYTES} to ${MAX_BYTES} base64-encoded random bytes`,
      );
    }

    return new ProvisionSecret(raw);
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

  equals(other: ProvisionSecret): boolean {
    return this.#value === other.#value;
  }

  toString(): string {
    return WITHHELD;
  }

  toJSON(): string {
    return WITHHELD;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `ProvisionSecret ${WITHHELD}`;
  }
}
