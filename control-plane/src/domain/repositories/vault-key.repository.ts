import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { VaultKey } from '@domain/value-objects/vault-key.vo';

export const VAULT_KEYS = Symbol('VAULT_KEYS');

export type VaultKeyLookup =
  | { readonly kind: 'held'; readonly key: VaultKey }
  | { readonly kind: 'none' }
  | { readonly kind: 'unreadable' };

export interface VaultKeyRepository {
  of(teamId: TeamId): Promise<VaultKeyLookup>;

  keepFirst(teamId: TeamId, key: VaultKey): Promise<VaultKeyLookup>;
}
