import type { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import { VaultSecrets } from '@configuration/domain/value-objects/vault-secrets.vo';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export interface VaultRefusal {
  readonly because:
    | 'unkeyed'
    | 'unreadable-key'
    | 'not-for-this-key'
    | 'unreadable';
  readonly detail?: string;
}

export type VaultOpening =
  | { readonly opened: true; readonly vault: Vault }
  | { readonly opened: false; readonly refusal: VaultRefusal };

export class Vault implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(
    readonly key: VaultKey,
    readonly secrets: VaultSecrets,
  ) {}

  static empty(key: VaultKey): Vault {
    return new Vault(key, VaultSecrets.none());
  }

  static opened(key: VaultKey, secrets: VaultSecrets): Vault {
    return new Vault(key, secrets);
  }

  get names(): readonly SecretName[] {
    return this.secrets.names;
  }

  sealWith(added: VaultSecrets): Vault {
    return new Vault(this.key, this.secrets.with(added));
  }

  missing(needed: readonly SecretName[]): readonly SecretName[] {
    return this.secrets.missing(needed);
  }

  toJSON(): string {
    return '[vault]';
  }
}
