import type { JudgingRepository } from '@outcomes/domain/repositories/judging.repository';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@outcomes/domain/repositories/score.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ForgetOutcomes {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly deliveries: TaskDeliveryRepository,
    private readonly judgings: JudgingRepository,
    private readonly scores: ScoreRepository,
    private readonly transaction: TransactionPort,
  ) {}

  runsOfTask(taskId: TaskId): Promise<void> {
    return this.records.removeForTask(taskId);
  }

  deliveryOfTask(taskId: TaskId): Promise<void> {
    return this.deliveries.removeForTask(taskId);
  }

  judgingsAndScoresOfTask(taskId: TaskId): Promise<void> {
    return this.transaction.run(async () => {
      await this.judgings.removeForTask(taskId);
      await this.scores.removeForTask(taskId);
    });
  }

  runsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.records.removeForTeam(workspaceId, teamId);
  }

  judgingsAndScoresOfTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<void> {
    return this.transaction.run(async () => {
      await this.judgings.removeForTeam(workspaceId, teamId);
      await this.scores.removeForTeam(workspaceId, teamId);
    });
  }

  runsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.records.removeForWorkspace(workspaceId);
  }

  deliveriesOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.deliveries.removeForWorkspace(workspaceId);
  }

  judgingsAndScoresOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.transaction.run(async () => {
      await this.judgings.removeForWorkspace(workspaceId);
      await this.scores.removeForWorkspace(workspaceId);
    });
  }
}
