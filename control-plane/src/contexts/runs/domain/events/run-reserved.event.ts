import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunReserved implements DomainEvent {
  readonly kind = 'run.reserved';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly runner: RunnerId,
    readonly pool: PoolId,
  ) {}
}
