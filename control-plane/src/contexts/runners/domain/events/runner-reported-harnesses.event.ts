import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerReportedHarnesses implements DomainEvent {
  readonly kind = 'runner.reported-harnesses';

  constructor(
    readonly runnerId: RunnerId,
    readonly workspaceId: WorkspaceId,
    readonly harnesses: readonly HarnessId[],
  ) {}
}
