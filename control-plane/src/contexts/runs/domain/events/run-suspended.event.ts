import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunSuspended implements DomainEvent {
  readonly kind = 'run.suspended';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly requester: RunRequester,
    readonly runner: RunnerId,
    readonly at: Date,
    readonly attempt: number,
  ) {}
}
