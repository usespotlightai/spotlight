import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunnerTrustRepository {
  add(trust: RunnerTrust): Promise<void>;

  save(trust: RunnerTrust): Promise<void>;

  find(id: RunnerTrustId): Promise<RunnerTrust | null>;

  inWorkspace(workspaceId: WorkspaceId): Promise<readonly RunnerTrust[]>;
}
