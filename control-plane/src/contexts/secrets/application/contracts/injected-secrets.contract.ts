import { Credential } from '@secrets/application/contracts/credential.contract';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';
import type { SecretLocation } from '@shared-kernel/domain/value-objects/secret-locations';

export interface SecretInjectionTarget {
  readonly location: SecretLocation;
  readonly name: string;
}

export interface InjectedValue extends SecretInjectionTarget {
  readonly value: Credential;
  readonly bare: Credential;
}

const REDACTED = '[secret]';

export class InjectedSecrets implements Secret {
  readonly #injected: readonly InjectedValue[];

  private constructor(injected: readonly InjectedValue[]) {
    this.#injected = injected;
  }

  static none(): InjectedSecrets {
    return new InjectedSecrets([]);
  }

  static of(
    injected: readonly (SecretInjectionTarget & {
      readonly value: string;
      readonly bare: string;
    })[],
  ): InjectedSecrets {
    return new InjectedSecrets(
      injected.map((each) => ({
        location: each.location,
        name: each.name,
        value: Credential.of(each.value),
        bare: Credential.of(each.bare),
      })),
    );
  }

  get [SECRET](): true {
    return true;
  }

  get isEmpty(): boolean {
    return this.#injected.length === 0;
  }

  get injected(): readonly InjectedValue[] {
    return this.#injected;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `InjectedSecrets ${REDACTED}`;
  }
}
