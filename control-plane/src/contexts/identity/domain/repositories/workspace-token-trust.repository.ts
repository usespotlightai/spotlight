import type { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export interface WorkspaceTokenTrustRepository {
  add(trust: WorkspaceTokenTrust): Promise<void>;

  save(trust: WorkspaceTokenTrust): Promise<void>;

  find(id: WorkspaceTokenTrustId): Promise<WorkspaceTokenTrust | null>;

  findLocked(id: WorkspaceTokenTrustId): Promise<WorkspaceTokenTrust | null>;
}
