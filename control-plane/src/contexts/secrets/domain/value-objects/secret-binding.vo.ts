import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { BoundHost } from '@secrets/domain/value-objects/bound-host.vo';
import type { SecretLocation } from '@secrets/domain/value-objects/secret-location.vo';
import { SecretTarget } from '@secrets/domain/value-objects/secret-target.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

const PREFIX = /^[\x20-\x7e]{0,64}$/;

const REDACTED = '[secret]';

export class InjectedSecret implements Secret {
  readonly #value: string;

  readonly #bare: string;

  constructor(
    readonly location: SecretLocation,
    readonly name: string,
    value: string,
    bare: string,
  ) {
    this.#value = value;
    this.#bare = bare;
  }

  get [SECRET](): true {
    return true;
  }

  revealedValue(): string {
    return this.#value;
  }

  revealedBare(): string {
    return this.#bare;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `InjectedSecret ${REDACTED}`;
  }
}

export class SecretBinding {
  private constructor(
    readonly host: BoundHost,
    readonly target: SecretTarget,
    readonly prefix: string,
  ) {}

  static of(input: {
    host: string;
    location?: string | null;
    name?: string | null;
    prefix?: string | null;
  }): SecretBinding {
    const host = BoundHost.of(input.host);
    const prefix = input.prefix ?? '';
    const target = SecretTarget.of(input);

    if (!PREFIX.test(prefix)) {
      throw new InvalidSecretError(
        'prefix',
        'must be at most 64 printable characters, as in "Bearer "',
      );
    }

    return new SecretBinding(host, target, prefix);
  }

  matches(url: URL): boolean {
    return this.host.serves(url);
  }

  inject(value: SecretValue): InjectedSecret {
    return this.injected(value.revealed());
  }

  standIn(secret: SecretName): InjectedSecret {
    return this.injected(secret.standIn);
  }

  private injected(bare: string): InjectedSecret {
    return new InjectedSecret(
      this.target.location,
      this.target.name,
      `${this.prefix}${bare}`,
      bare,
    );
  }

  equals(other: SecretBinding): boolean {
    return (
      this.host.equals(other.host) &&
      this.target.equals(other.target) &&
      this.prefix === other.prefix
    );
  }
}
