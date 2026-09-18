import type { SecretValue } from '@configuration/domain/value-objects/secret-value.vo';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export interface VaultSecret {
  readonly name: SecretName;
  readonly value: SecretValue;
}

export class VaultSecrets implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(
    private readonly held: ReadonlyMap<string, VaultSecret>,
  ) {}

  static of(secrets: readonly VaultSecret[]): VaultSecrets {
    return new VaultSecrets(
      new Map(secrets.map((each) => [each.name.value, each])),
    );
  }

  static none(): VaultSecrets {
    return new VaultSecrets(new Map());
  }

  get entries(): readonly VaultSecret[] {
    return [...this.held.values()].sort((a, b) =>
      a.name.value.localeCompare(b.name.value),
    );
  }

  get names(): readonly SecretName[] {
    return this.entries.map((each) => each.name);
  }

  valueOf(name: SecretName): SecretValue | null {
    return this.held.get(name.value)?.value ?? null;
  }

  holds(name: SecretName): boolean {
    return this.held.has(name.value);
  }

  missing(needed: readonly SecretName[]): readonly SecretName[] {
    return needed.filter((name) => !this.holds(name));
  }

  with(added: VaultSecrets): VaultSecrets {
    return new VaultSecrets(new Map([...this.held, ...added.held]));
  }

  toJSON(): string {
    return '[vault secrets]';
  }
}
