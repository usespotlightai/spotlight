import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';

export const BearerAdmission = {
  admits(
    token: WorkspaceToken,
    mintedThrough: WorkspaceTokenTrust | null,
    now: Date,
  ): boolean {
    if (!token.admitsAt(now)) {
      return false;
    }

    return !token.isMinted || mintedThrough?.stillGrants(token) === true;
  },
};
