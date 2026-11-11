import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { OidcTrustId } from '@identity/domain/value-objects/oidc-trust-id.vo';
import type { RunAttempt } from '@identity/domain/value-objects/run-attempt.vo';
import type { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspaceTokenRepository {
  add(token: WorkspaceToken): Promise<void>;

  save(token: WorkspaceToken): Promise<void>;

  find(id: WorkspaceTokenId): Promise<WorkspaceToken | null>;

  findByHash(hash: TokenHash): Promise<WorkspaceToken | null>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly WorkspaceToken[]>;

  issuedByTrust(trustId: OidcTrustId): Promise<readonly WorkspaceToken[]>;

  issuedForRun(
    workspaceId: WorkspaceId,
    runId: RunId,
    attempt: RunAttempt | null,
  ): Promise<readonly WorkspaceToken[]>;

  dueToExpireBy(now: Date, limit: number): Promise<readonly WorkspaceToken[]>;
}
