import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StationAlertReopened implements DomainEvent {
  readonly kind = 'station-alert.reopened';

  constructor(
    readonly alertId: AlertId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: string,
    readonly taskId: TaskId,
  ) {}
}
