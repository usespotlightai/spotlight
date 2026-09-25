import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export interface WorkspaceTokenRepository {
  add(token: WorkspaceToken): Promise<void>;

  save(token: WorkspaceToken): Promise<void>;

  find(id: WorkspaceTokenId): Promise<WorkspaceToken | null>;

  bearing(hash: TokenHash): Promise<WorkspaceToken | null>;

  mintedThrough(
    trustId: WorkspaceTokenTrustId,
  ): Promise<readonly WorkspaceToken[]>;

  mintedAndExpiredBy(
    now: Date,
    limit: number,
  ): Promise<readonly WorkspaceToken[]>;
}
