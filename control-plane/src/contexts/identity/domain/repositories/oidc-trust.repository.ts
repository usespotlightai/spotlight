import type { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';

export interface OidcTrustRepository {
  add(trust: OidcTrust): Promise<void>;

  save(trust: OidcTrust): Promise<void>;

  find(id: OidcTrustId): Promise<OidcTrust | null>;

  findLocked(id: OidcTrustId): Promise<OidcTrust | null>;
}
