import type { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const OIDC_TRUST_USAGE = Symbol('OIDC_TRUST_USAGE');

export interface OidcTrustUsagePort {
  issued(
    trustId: OidcTrustId,
    workspaceId: WorkspaceId,
    at: Date,
  ): Promise<void>;

  forget(trustId: OidcTrustId): Promise<void>;
}
