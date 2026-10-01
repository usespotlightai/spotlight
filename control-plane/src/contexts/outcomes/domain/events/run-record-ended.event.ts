import type { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunRecordEnded implements DomainEvent {
  readonly kind = 'run-record.ended';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly place: RunPlace,
  ) {}
}
