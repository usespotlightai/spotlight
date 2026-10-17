import type { DeliveryState } from '@outcomes/domain/value-objects/delivery-state';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface BotActivity {
  readonly login: string;
  readonly reviews: number;
  readonly comments: number;
  readonly threads: number;
  readonly resolvedThreads: number;
}

interface DraftSpell {
  readonly from: Date;
  readonly to: Date | null;
}

export interface SeenPullRequest {
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly author: string | null;
  readonly authorIsBot: boolean;
  readonly branch: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly changedFiles: number | null;
  readonly openedAt: Date;
  readonly state: DeliveryState;
  readonly closedAt: Date | null;
  readonly updatedAt: Date;
  readonly readyForReviewAt: Date | null;
  readonly draftSpells: readonly DraftSpell[];
  readonly firstReviewAt: Date | null;
  readonly firstUnblockingReviewAt: Date | null;
  readonly firstApprovedAt: Date | null;
  readonly humanReviewedAt: readonly Date[];
  readonly reviews: number;
  readonly reviewRounds: number;
  readonly reviewComments: number;
  readonly botActivity: readonly BotActivity[];
  readonly isRevert: boolean;
  readonly revertedBy: string | null;
  readonly version: number;
}

export interface PullRequestOwner {
  readonly taskId: TaskId;
  readonly teamId: TeamId;
}

export class PullRequestRecord {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly seen: SeenPullRequest | null,
    readonly owner: PullRequestOwner | null,
    readonly reviewTasks: readonly TaskId[],
    readonly githubForgotAt: Date | null,
    readonly version: number,
  ) {}

  static noted(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): PullRequestRecord {
    return new PullRequestRecord(
      workspaceId,
      pullRequest,
      null,
      null,
      [],
      null,
      0,
    );
  }

  static rehydrate(input: {
    workspaceId: WorkspaceId;
    pullRequest: PullRequestUrl;
    seen: SeenPullRequest | null;
    owner: PullRequestOwner | null;
    reviewTasks: readonly TaskId[];
    githubForgotAt: Date | null;
    version: number;
  }): PullRequestRecord {
    return new PullRequestRecord(
      input.workspaceId,
      input.pullRequest,
      input.seen,
      input.owner,
      input.reviewTasks,
      input.githubForgotAt,
      input.version,
    );
  }

  get outlivesGitHub(): boolean {
    return this.owner !== null || this.reviewTasks.length > 0;
  }

  get holdsNothing(): boolean {
    return (
      (this.seen === null || this.githubForgotAt !== null) &&
      !this.outlivesGitHub
    );
  }

  seenAs(seen: SeenPullRequest): PullRequestRecord {
    if (this.githubForgotAt) {
      return seen.updatedAt.getTime() > this.githubForgotAt.getTime()
        ? this.with({ seen, githubForgotAt: null })
        : this;
    }

    if (this.seen && seen.version <= this.seen.version) {
      return this;
    }

    return this.with({ seen });
  }

  assignOwner(owner: PullRequestOwner): PullRequestRecord {
    if (
      this.owner?.taskId.equals(owner.taskId) &&
      this.owner.teamId.equals(owner.teamId)
    ) {
      return this;
    }

    return this.with({ owner });
  }

  recordReview(taskId: TaskId): PullRequestRecord {
    if (this.reviewTasks.some((each) => each.equals(taskId))) {
      return this;
    }

    return this.with({ reviewTasks: [...this.reviewTasks, taskId] });
  }

  forgottenByGitHub(updatedAt: Date): PullRequestRecord | null {
    if (
      this.seen &&
      !this.githubForgotAt &&
      this.seen.updatedAt.getTime() > updatedAt.getTime()
    ) {
      return this;
    }

    if (!this.outlivesGitHub) {
      return null;
    }

    return this.githubForgotAt &&
      this.githubForgotAt.getTime() >= updatedAt.getTime()
      ? this
      : this.with({ githubForgotAt: updatedAt });
  }

  withoutTask(taskId: TaskId): PullRequestRecord | null {
    const owned = this.owner?.taskId.equals(taskId) ?? false;
    const reviewed = this.reviewTasks.some((each) => each.equals(taskId));

    if (!owned && !reviewed) {
      return this;
    }

    return this.with({
      owner: owned ? null : this.owner,
      reviewTasks: this.reviewTasks.filter((each) => !each.equals(taskId)),
    }).keptAtAll();
  }

  withoutTeam(teamId: TeamId): PullRequestRecord | null {
    if (!this.owner?.teamId.equals(teamId)) {
      return this;
    }

    return this.with({ owner: null }).keptAtAll();
  }

  private keptAtAll(): PullRequestRecord | null {
    return this.holdsNothing ? null : this;
  }

  private with(
    change: Partial<{
      seen: SeenPullRequest | null;
      owner: PullRequestOwner | null;
      reviewTasks: readonly TaskId[];
      githubForgotAt: Date | null;
    }>,
  ): PullRequestRecord {
    return new PullRequestRecord(
      this.workspaceId,
      this.pullRequest,
      change.seen !== undefined ? change.seen : this.seen,
      change.owner !== undefined ? change.owner : this.owner,
      change.reviewTasks ?? this.reviewTasks,
      change.githubForgotAt !== undefined
        ? change.githubForgotAt
        : this.githubForgotAt,
      this.version,
    );
  }
}
