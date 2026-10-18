import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerPoolUpdated implements ConfigurationChanged {
  readonly kind = 'runner-pool.updated';

  constructor(
    readonly poolId: RunnerPoolId,
    readonly workspaceId: WorkspaceId,
    readonly key: PoolKey,
    readonly change: ConfigurationChange,
  ) {}
}
