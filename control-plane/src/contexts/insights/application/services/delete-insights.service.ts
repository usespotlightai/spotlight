import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { PendingReviewsPort } from '@insights/application/ports/pending-reviews.port';
import type { StationConfigPullRequestsPort } from '@insights/application/ports/station-config-pull-requests.port';
import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { PullRequestRecordVersionConflictError } from '@insights/domain/exceptions/pull-request-record-version-conflict.error';
import type { ChangeJudgingRepository } from '@insights/domain/repositories/change-judging.repository';
import type { ChatRecordRepository } from '@insights/domain/repositories/chat-record.repository';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import type { SideBySideJudgingRepository } from '@insights/domain/repositories/side-by-side-judging.repository';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';
import type { TaskChangeShapeRepository } from '@insights/domain/repositories/task-change-shape.repository';
import type { TaskFailuresRepository } from '@insights/domain/repositories/task-failures.repository';
import type { TaskHumanActionsRepository } from '@insights/domain/repositories/task-human-actions.repository';
import type { TaskPullRequestRepository } from '@insights/domain/repositories/task-pull-request.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

export interface InsightsRepositories {
  readonly records: RunRecordRepository;
  readonly taskPullRequests: TaskPullRequestRepository;
  readonly judgings: JudgingRepository;
  readonly changeJudgings: ChangeJudgingRepository;
  readonly sideBySideJudgings: SideBySideJudgingRepository;
  readonly scores: ScoreRepository;
  readonly taskHumanActions: TaskHumanActionsRepository;
  readonly failures: TaskFailuresRepository;
  readonly chats: ChatRecordRepository;
  readonly pullRequests: PullRequestRecordRepository;
  readonly shapes: TaskChangeShapeRepository;
  readonly alertStates: StationAlertStateRepository;
  readonly reviews: PendingReviewsPort;
  readonly configPullRequests: StationConfigPullRequestsPort;
  readonly deletions: DeletionsPort;
}

export class DeleteInsights {
  constructor(
    private readonly repositories: InsightsRepositories,
    private readonly transaction: TransactionPort,
  ) {}

  runsOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, () =>
      this.repositories.records.removeForTask(taskId),
    );
  }

  taskPullRequestOfTask(
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<void> {
    return this.ofTask(workspaceId, taskId, async () => {
      const taskPullRequest =
        await this.repositories.taskPullRequests.forTask(taskId);

      if (taskPullRequest) {
        await this.repositories.reviews.release(
          workspaceId,
          taskPullRequest.pullRequest,
        );
      }

      await this.repositories.taskPullRequests.removeForTask(taskId);
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

  humanActionsOfTask(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.ofTask(workspaceId, taskId, () =>
      this.repositories.taskHumanActions.removeForTask(taskId),
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

    for (const stationId of await this.repositories.alertStates.stationsWithTask(
      taskId,
    )) {
      await this.transaction.inTransaction(async () => {
        const alertState = await this.repositories.alertStates.of(
          stationId,
          taskId,
        );
        const updated = alertState?.withoutTask(taskId);

        if (alertState && updated && updated !== alertState) {
          await this.repositories.alertStates.save(updated);
        }
      });
    }
  }

  alertsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.repositories.alertStates.removeForTeam(workspaceId, teamId),
    );
  }

  alertsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.repositories.alertStates.removeForWorkspace(workspaceId),
    );
  }

  runsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.repositories.records.removeForTeam(workspaceId, teamId),
    );
  }

  taskPullRequestsOfTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<void> {
    return this.ofTeam(workspaceId, teamId, async () => {
      for (const taskPullRequest of await this.repositories.taskPullRequests.ofTeam(
        workspaceId,
        teamId,
      )) {
        await this.repositories.reviews.release(
          workspaceId,
          taskPullRequest.pullRequest,
        );
      }

      await this.repositories.taskPullRequests.removeForTeam(
        workspaceId,
        teamId,
      );
    });
  }

  judgingsAndScoresOfTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<void> {
    return this.ofTeam(workspaceId, teamId, async () => {
      await this.repositories.judgings.removeForTeam(workspaceId, teamId);
      await this.repositories.changeJudgings.removeForTeam(workspaceId, teamId);
      await this.repositories.sideBySideJudgings.removeForTeam(
        workspaceId,
        teamId,
      );
      await this.repositories.scores.removeForTeam(workspaceId, teamId);
    });
  }

  humanActionsOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    return this.ofTeam(workspaceId, teamId, () =>
      this.repositories.taskHumanActions.removeForTeam(workspaceId, teamId),
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

  taskPullRequestsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, async () => {
      await this.repositories.taskPullRequests.removeForWorkspace(workspaceId);
      await this.repositories.reviews.releaseWorkspace(workspaceId);
    });
  }

  judgingsAndScoresOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, async () => {
      await this.repositories.judgings.removeForWorkspace(workspaceId);
      await this.repositories.changeJudgings.removeForWorkspace(workspaceId);
      await this.repositories.sideBySideJudgings.removeForWorkspace(
        workspaceId,
      );
      await this.repositories.scores.removeForWorkspace(workspaceId);
    });
  }

  humanActionsOfWorkspace(workspaceId: WorkspaceId): Promise<void> {
    return this.ofWorkspace(workspaceId, () =>
      this.repositories.taskHumanActions.removeForWorkspace(workspaceId),
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
