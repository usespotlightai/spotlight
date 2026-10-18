import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StationAlertFired implements DomainEvent {
  readonly kind = 'station-alert.fired';

  constructor(
    readonly alertId: AlertId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly stationId: string,
    readonly taskId: TaskId,
    readonly runId: RunId,
  ) {}
}
