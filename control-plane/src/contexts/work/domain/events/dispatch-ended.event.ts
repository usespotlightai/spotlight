import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { DispatchEnding } from '@work/domain/value-objects/dispatch-ending.vo';

export class DispatchEnded implements DomainEvent {
  readonly kind = 'dispatch.ended';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId | null,
    readonly stationId: StationId | null,
    readonly ending: DispatchEnding,
  ) {}
}
