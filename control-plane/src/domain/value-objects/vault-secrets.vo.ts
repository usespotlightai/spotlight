import type { SecretName } from '@domain/value-objects/secret-name.vo';
import type { SecretValue } from '@domain/value-objects/secret-value.vo';

export interface VaultSecret {
  readonly name: SecretName;
  readonly value: SecretValue;
}

export class VaultSecrets {
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

  with(added: VaultSecrets): VaultSecrets {
    return new VaultSecrets(new Map([...this.held, ...added.held]));
  }
}
