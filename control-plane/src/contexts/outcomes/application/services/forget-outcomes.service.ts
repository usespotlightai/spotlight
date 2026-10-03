import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type { PendingReviewsPort } from '@outcomes/application/ports/pending-reviews.port';
import type { PullRequestRecord } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import { PullRequestRecordMovedOnError } from '@outcomes/domain/exceptions/pull-request-record-moved-on.error';
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

export interface OutcomesHeld {
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
  readonly forgotten: ForgottenPort;
}

export class ForgetOutcomes {
  constructor(
    private readonly held: OutcomesHeld,
    private readonly transaction: TransactionPort,
  ) {}

  runsOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, () =>
      this.held.records.removeForTask(taskId),
    );
  }

  deliveryOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, async () => {
      const delivery = await this.held.deliveries.forTask(taskId);

      if (delivery) {
        await this.held.reviews.release(workspaceId, delivery.pullRequest);
      }

      await this.held.deliveries.removeForTask(taskId);
    });
  }

  judgingsAndScoresOfTask(
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<void> {
    return this.ofTask(workspaceId, taskId, async () => {
      await this.held.judgings.removeForTask(taskId);
      await this.held.scores.removeForTask(taskId);
    });
  }

  touchesOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, () =>
      this.held.touches.removeForTask(taskId),
    );
  }

  failuresOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, () =>
      this.held.failures.removeForTask(taskId),
    );
  }

  async pullRequestsOfTask(
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<void> {
    await this.ofTask(workspaceId, taskId, () =>
      this.held.shapes.removeForTask(taskId),
    );

    for (const record of await this.held.pullRequests.heldByTask(
      workspaceId,
      taskId,
    )) {
      await this.lettingGo(record, (held) => held.withoutTask(taskId));
    }
  }

  async alertsOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    await this.transaction.run(() =>
      this.held.forgotten.forgetTask(workspaceId, taskId),
    );

    for (const stationId of await this.held.watches.stationsHolding(taskId)) {
      await this.transaction.run(async () => {
        const watch = await this.held.watches.of(stationId, taskId);
        const kept = watch?.withoutTask(taskId);

        if (watch && kept && kept !== watch) {
          await this.held.watches.save(kept);
        }
      });
    }
  }

  alertsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.held.watches.removeForTeam(workspaceId, teamId),
    );
  }

  alertsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.held.watches.removeForWorkspace(workspaceId),
    );
  }

  runsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.held.records.removeForTeam(workspaceId, teamId),
    );
  }

  deliveriesOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, async () => {
      for (const delivery of await this.held.deliveries.ofTeam(
        workspaceId,
        teamId,
      )) {
        await this.held.reviews.release(workspaceId, delivery.pullRequest);
      }

      await this.held.deliveries.removeForTeam(workspaceId, teamId);
    });
  }

  judgingsAndScoresOfTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<void> {
    return this.ofTeam(workspaceId, teamId, async () => {
      await this.held.judgings.removeForTeam(workspaceId, teamId);
      await this.held.changeJudgings.removeForTeam(workspaceId, teamId);
      await this.held.pairJudgings.removeForTeam(workspaceId, teamId);
      await this.held.scores.removeForTeam(workspaceId, teamId);
    });
  }

  touchesOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.held.touches.removeForTeam(workspaceId, teamId),
    );
  }

  failuresOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.held.failures.removeForTeam(workspaceId, teamId),
    );
  }

  chatsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.held.chats.removeForTeam(workspaceId, teamId),
    );
  }

  async pullRequestsOfTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<void> {
    await this.ofTeam(workspaceId, teamId, () =>
      this.held.shapes.removeForTeam(workspaceId, teamId),
    );

    for (const record of await this.held.pullRequests.ownedByTeam(
      workspaceId,
      teamId,
    )) {
      await this.lettingGo(record, (held) => held.withoutTeam(teamId));
    }
  }

  runsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.held.records.removeForWorkspace(workspaceId),
    );
  }

  deliveriesOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, async () => {
      await this.held.deliveries.removeForWorkspace(workspaceId);
      await this.held.reviews.releaseWorkspace(workspaceId);
    });
  }

  judgingsAndScoresOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, async () => {
      await this.held.judgings.removeForWorkspace(workspaceId);
      await this.held.changeJudgings.removeForWorkspace(workspaceId);
      await this.held.pairJudgings.removeForWorkspace(workspaceId);
      await this.held.scores.removeForWorkspace(workspaceId);
    });
  }

  touchesOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.held.touches.removeForWorkspace(workspaceId),
    );
  }

  failuresOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.held.failures.removeForWorkspace(workspaceId),
    );
  }

  chatsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.held.chats.removeForWorkspace(workspaceId),
    );
  }

  pullRequestsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, async () => {
      await this.held.pullRequests.removeForWorkspace(workspaceId);
      await this.held.shapes.removeForWorkspace(workspaceId);
    });
  }

  private async lettingGo(
    record: PullRequestRecord,
    letGo: (held: PullRequestRecord) => PullRequestRecord | null,
  ): Promise<void> {
    for (let left = ATTEMPTS; ; left -= 1) {
      try {
        await this.transaction.run(async () => {
          await this.held.forgotten.holdingPullRequest(
            record.workspaceId,
            record.pullRequest,
          );
          const held = await this.held.pullRequests.at(
            record.workspaceId,
            record.pullRequest,
          );

          if (!held) {
            return;
          }

          const kept = letGo(held);

          if (kept === null) {
            await this.held.pullRequests.remove(held);
          } else if (kept !== held) {
            await this.held.pullRequests.save(kept);
          }
        });
        return;
      } catch (error) {
        if (!(error instanceof PullRequestRecordMovedOnError) || left <= 1) {
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
    return this.transaction.run(async () => {
      await this.held.forgotten.forgetTask(workspaceId, taskId);
      await remove();
    });
  }

  private ofTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
    remove: () => Promise<void>,
  ): Promise<void> {
    return this.transaction.run(async () => {
      await this.held.forgotten.forgetTeam(workspaceId, teamId);
      await remove();
    });
  }

  private ofWorkspace(
    workspaceId: WorkspaceId,
    remove: () => Promise<void>,
  ): Promise<void> {
    return this.transaction.run(async () => {
      await this.held.forgotten.forgetWorkspace(workspaceId);
      await remove();
    });
  }
}
