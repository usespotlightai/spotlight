import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerEnrolled implements DomainEvent {
  readonly kind = 'runner.enrolled';

  constructor(
    readonly runnerId: RunnerId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
