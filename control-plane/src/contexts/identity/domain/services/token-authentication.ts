import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';

export const TokenAuthentication = {
  authenticates(
    token: WorkspaceToken,
    issuedByTrust: WorkspaceTokenTrust | null,
    now: Date,
  ): boolean {
    return token.isActiveAt(now) && token.isStillValidFor(issuedByTrust);
  },
};
