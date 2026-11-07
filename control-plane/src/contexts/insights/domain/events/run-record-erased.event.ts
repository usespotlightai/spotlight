import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunRecordErased implements DomainEvent {
  readonly kind = 'run-record.erased';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
