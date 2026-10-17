import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import type { PendingReviewsPort } from '@outcomes/application/ports/pending-reviews.port';
import type { StationConfigPullRequestsPort } from '@outcomes/application/ports/station-config-pull-requests.port';
import type { PullRequestRecord } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import { PullRequestRecordVersionConflictError } from '@outcomes/domain/exceptions/pull-request-record-version-conflict.error';
import type { ChangeJudgingRepository } from '@outcomes/domain/repositories/change-judging.repository';
import type { ChatRecordRepository } from '@outcomes/domain/repositories/chat-record.repository';
import type { JudgingRepository } from '@outcomes/domain/repositories/judging.repository';
import type { PairJudgingRepository } from '@outcomes/domain/repositories/pair-judging.repository';
import type { PullRequestRecordRepository } from '@outcomes/domain/repositories/pull-request-record.repository';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@outcomes/domain/repositories/score.repository';
import type { StationWatchRepository } from '@outcomes/domain/repositories/station-watch.repository';
import type { TaskChangeShapeRepository } from '@outcomes/domain/repositories/task-change-shape.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import type { TaskFailuresRepository } from '@outcomes/domain/repositories/task-failures.repository';
import type { TaskTouchesRepository } from '@outcomes/domain/repositories/task-touches.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

export interface OutcomesRepositories {
  readonly records: RunRecordRepository;
  readonly deliveries: TaskDeliveryRepository;
  readonly judgings: JudgingRepository;
  readonly changeJudgings: ChangeJudgingRepository;
  readonly pairJudgings: PairJudgingRepository;
  readonly scores: ScoreRepository;
  readonly touches: TaskTouchesRepository;
  readonly failures: TaskFailuresRepository;
  readonly chats: ChatRecordRepository;
  readonly pullRequests: PullRequestRecordRepository;
  readonly shapes: TaskChangeShapeRepository;
  readonly watches: StationWatchRepository;
  readonly reviews: PendingReviewsPort;
  readonly configPullRequests: StationConfigPullRequestsPort;
  readonly deletions: DeletionsPort;
}

export class DeleteOutcomes {
  constructor(
    private readonly repositories: OutcomesRepositories,
    private readonly transaction: TransactionPort,
  ) {}

  runsOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, () =>
      this.repositories.records.removeForTask(taskId),
    );
  }

  deliveryOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, async () => {
      const delivery = await this.repositories.deliveries.forTask(taskId);

      if (delivery) {
        await this.repositories.reviews.release(
          workspaceId,
          delivery.pullRequest,
        );
      }

      await this.repositories.deliveries.removeForTask(taskId);
    });
  }

  judgingsAndScoresOfTask(
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<void> {
    return this.ofTask(workspaceId, taskId, async () => {
      await this.repositories.judgings.removeForTask(taskId);
      await this.repositories.scores.removeForTask(taskId);
    });
  }

  touchesOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, () =>
      this.repositories.touches.removeForTask(taskId),
    );
  }

  failuresOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, () =>
      this.repositories.failures.removeForTask(taskId),
    );
  }

  async pullRequestsOfTask(
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<void> {
    await this.ofTask(workspaceId, taskId, () =>
      this.repositories.shapes.removeForTask(taskId),
    );

    for (const record of await this.repositories.pullRequests.findByTask(
      workspaceId,
      taskId,
    )) {
      await this.removeFromPullRequest(record, (each) =>
        each.withoutTask(taskId),
      );
    }
  }

  async alertsOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    await this.transaction.inTransaction(() =>
      this.repositories.deletions.deleteTask(workspaceId, taskId),
    );

    for (const stationId of await this.repositories.watches.stationsWithTask(
      taskId,
    )) {
      await this.transaction.inTransaction(async () => {
        const watch = await this.repositories.watches.of(stationId, taskId);
        const updated = watch?.withoutTask(taskId);

        if (watch && updated && updated !== watch) {
          await this.repositories.watches.save(updated);
        }
      });
    }
  }

  alertsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.repositories.watches.removeForTeam(workspaceId, teamId),
    );
  }

  alertsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.repositories.watches.removeForWorkspace(workspaceId),
    );
  }

  runsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.repositories.records.removeForTeam(workspaceId, teamId),
    );
  }

  deliveriesOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, async () => {
      for (const delivery of await this.repositories.deliveries.ofTeam(
        workspaceId,
        teamId,
      )) {
        await this.repositories.reviews.release(
          workspaceId,
          delivery.pullRequest,
        );
      }

      await this.repositories.deliveries.removeForTeam(workspaceId, teamId);
    });
  }

  judgingsAndScoresOfTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<void> {
    return this.ofTeam(workspaceId, teamId, async () => {
      await this.repositories.judgings.removeForTeam(workspaceId, teamId);
      await this.repositories.changeJudgings.removeForTeam(workspaceId, teamId);
      await this.repositories.pairJudgings.removeForTeam(workspaceId, teamId);
      await this.repositories.scores.removeForTeam(workspaceId, teamId);
    });
  }

  touchesOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.repositories.touches.removeForTeam(workspaceId, teamId),
    );
  }

  failuresOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.repositories.failures.removeForTeam(workspaceId, teamId),
    );
  }

  chatsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.repositories.chats.removeForTeam(workspaceId, teamId),
    );
  }

  async pullRequestsOfTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<void> {
    await this.ofTeam(workspaceId, teamId, () =>
      this.repositories.shapes.removeForTeam(workspaceId, teamId),
    );

    for (const record of await this.repositories.pullRequests.ownedByTeam(
      workspaceId,
      teamId,
    )) {
      await this.removeFromPullRequest(record, (each) =>
        each.withoutTeam(teamId),
      );
    }
  }

  configPullRequestsOfTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.repositories.configPullRequests.removeForTeam(workspaceId, teamId),
    );
  }

  configPullRequestsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.repositories.configPullRequests.removeForWorkspace(workspaceId),
    );
  }

  runsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.repositories.records.removeForWorkspace(workspaceId),
    );
  }

  deliveriesOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, async () => {
      await this.repositories.deliveries.removeForWorkspace(workspaceId);
      await this.repositories.reviews.releaseWorkspace(workspaceId);
    });
  }

  judgingsAndScoresOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, async () => {
      await this.repositories.judgings.removeForWorkspace(workspaceId);
      await this.repositories.changeJudgings.removeForWorkspace(workspaceId);
      await this.repositories.pairJudgings.removeForWorkspace(workspaceId);
      await this.repositories.scores.removeForWorkspace(workspaceId);
    });
  }

  touchesOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.repositories.touches.removeForWorkspace(workspaceId),
    );
  }

  failuresOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.repositories.failures.removeForWorkspace(workspaceId),
    );
  }

  chatsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.repositories.chats.removeForWorkspace(workspaceId),
    );
  }

  pullRequestsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, async () => {
      await this.repositories.pullRequests.removeForWorkspace(workspaceId);
      await this.repositories.shapes.removeForWorkspace(workspaceId);
    });
  }

  private async removeFromPullRequest(
    record: PullRequestRecord,
    without: (record: PullRequestRecord) => PullRequestRecord | null,
  ): Promise<void> {
    for (let left = ATTEMPTS; ; left -= 1) {
      try {
        await this.transaction.inTransaction(async () => {
          await this.repositories.deletions.lockPullRequestDeletion(
            record.workspaceId,
            record.pullRequest,
          );
          const existing = await this.repositories.pullRequests.at(
            record.workspaceId,
            record.pullRequest,
          );

          if (!existing) {
            return;
          }

          const updated = without(existing);

          if (updated === null) {
            await this.repositories.pullRequests.remove(existing);
          } else if (updated !== existing) {
            await this.repositories.pullRequests.save(updated);
          }
        });
        return;
      } catch (error) {
        if (
          !(error instanceof PullRequestRecordVersionConflictError) ||
          left <= 1
        ) {
          throw error;
        }
      }
    }
  }

  private ofTask(
    workspaceId: WorkspaceId,
    taskId: TaskId,
    remove: () => Promise<void>,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.repositories.deletions.deleteTask(workspaceId, taskId);
      await remove();
    });
  }

  private ofTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
    remove: () => Promise<void>,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.repositories.deletions.deleteTeam(workspaceId, teamId);
      await remove();
    });
  }

  private ofWorkspace(
    workspaceId: WorkspaceId,
    remove: () => Promise<void>,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      await this.repositories.deletions.deleteWorkspace(workspaceId);
      await remove();
    });
  }
}
