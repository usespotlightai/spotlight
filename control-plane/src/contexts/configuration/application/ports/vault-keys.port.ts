import type { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const VAULT_KEYS = Symbol('VAULT_KEYS');

export type VaultKeyLookup =
  | { readonly kind: 'held'; readonly key: VaultKey }
  | { readonly kind: 'none' }
  | { readonly kind: 'unreadable' };

export interface VaultKeysPort {
  of(teamId: TeamId): Promise<VaultKeyLookup>;

  keepFirst(teamId: TeamId, key: VaultKey): Promise<VaultKeyLookup>;
}
