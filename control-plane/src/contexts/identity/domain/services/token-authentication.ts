import type { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';

export const TokenAuthentication = {
  authenticates(
    token: WorkspaceToken,
    issuedByTrust: OidcTrust | null,
    now: Date,
  ): boolean {
    return token.isActiveAt(now) && token.isStillValidFor(issuedByTrust);
  },
};
