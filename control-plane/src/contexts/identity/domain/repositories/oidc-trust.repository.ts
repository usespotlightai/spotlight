import type { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import type { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface OidcTrustRepository {
  add(trust: OidcTrust): Promise<void>;

  save(trust: OidcTrust): Promise<void>;

  find(id: OidcTrustId): Promise<OidcTrust | null>;

  findLocked(id: OidcTrustId): Promise<OidcTrust | null>;

  findByKey(
    workspaceId: WorkspaceId,
    key: OidcTrustKey,
  ): Promise<OidcTrust | null>;
}
