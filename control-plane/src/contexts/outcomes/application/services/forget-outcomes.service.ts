import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ForgetOutcomes {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly deliveries: TaskDeliveryRepository,
  ) {}

  runsOfTask(taskId: TaskId): Promise<void> {
    return this.records.removeForTask(taskId);
  }

  deliveryOfTask(taskId: TaskId): Promise<void> {
    return this.deliveries.removeForTask(taskId);
  }

  runsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.records.removeForTeam(workspaceId, teamId);
  }

  runsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.records.removeForWorkspace(workspaceId);
  }

  deliveriesOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.deliveries.removeForWorkspace(workspaceId);
  }
}
