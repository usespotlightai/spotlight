import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunnerRepository {
  add(runner: Runner): Promise<void>;

  save(runner: Runner): Promise<void>;

  find(id: RunnerId): Promise<Runner | null>;

  findByTokenHash(hash: TokenHash): Promise<Runner | null>;

  enrolledUnder(
    trustId: RunnerTrustId,
    name: RunnerName,
  ): Promise<Runner | null>;

  underTrust(trustId: RunnerTrustId): Promise<readonly Runner[]>;

  standingIn(workspaceId: WorkspaceId): Promise<readonly Runner[]>;
}
