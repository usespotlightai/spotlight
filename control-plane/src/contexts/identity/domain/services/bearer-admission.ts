import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';

export const BearerAdmission = {
  admits(
    token: WorkspaceToken,
    issuedByTrust: WorkspaceTokenTrust | null,
    now: Date,
  ): boolean {
    return token.admitsAt(now) && token.isStillValidFor(issuedByTrust);
  },
};
