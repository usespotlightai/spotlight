import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export interface WorkspaceTokenRepository {
  add(token: WorkspaceToken): Promise<void>;

  save(token: WorkspaceToken): Promise<void>;

  find(id: WorkspaceTokenId): Promise<WorkspaceToken | null>;

  findByHash(hash: TokenHash): Promise<WorkspaceToken | null>;

  issuedByTrust(
    trustId: WorkspaceTokenTrustId,
  ): Promise<readonly WorkspaceToken[]>;

  issuedForRun(
    workspaceId: WorkspaceId,
    runId: RunId,
    attempt: number | null,
  ): Promise<readonly WorkspaceToken[]>;

  issuedAndExpiredBy(
    now: Date,
    limit: number,
  ): Promise<readonly WorkspaceToken[]>;
}
