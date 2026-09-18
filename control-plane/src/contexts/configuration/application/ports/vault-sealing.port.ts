import type { SealedVault } from '@configuration/domain/value-objects/sealed-vault.vo';
import type { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import type { VaultSecrets } from '@configuration/domain/value-objects/vault-secrets.vo';

export const VAULT_SEALING = Symbol('VAULT_SEALING');

export type VaultOpening =
  | { readonly opened: true; readonly secrets: VaultSecrets }
  | {
      readonly opened: false;
      readonly because: 'not-for-this-key' | 'unreadable';
      readonly detail: string;
    };

export interface VaultSealingPort {
  issueKey(): VaultKey;

  open(vault: SealedVault, key: VaultKey): Promise<VaultOpening>;

  seal(secrets: VaultSecrets, key: VaultKey): Promise<SealedVault>;
}
