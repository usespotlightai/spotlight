import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

export interface WorkspaceTokenRepository {
  add(token: WorkspaceToken): Promise<void>;

  save(token: WorkspaceToken): Promise<void>;

  find(id: WorkspaceTokenId): Promise<WorkspaceToken | null>;

  bearing(hash: TokenHash): Promise<WorkspaceToken | null>;
}
