import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import {
  type ClassifiedRun,
  dispositionOf,
  effectiveEndingOf,
  resolutionOf,
} from '@insights/domain/services/run-classification';
import { type RunSize, sizeOf } from '@insights/domain/services/run-size';
import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';
import type { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import { HumanLabel } from '@insights/domain/value-objects/human-label.vo';
import type { PullRequestState } from '@insights/domain/value-objects/pull-request-state';
import type { RunActions } from '@insights/domain/value-objects/run-actions.vo';
import type { RunDisposition } from '@insights/domain/value-objects/run-disposition';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import {
  leftWork,
  type RunEnding,
} from '@insights/domain/value-objects/run-ending';
import type { RunMemories } from '@insights/domain/value-objects/run-memories.vo';
import type { RunResolution } from '@insights/domain/value-objects/run-resolution';
import type { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import type { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import type { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunPullRequest {
  readonly pullRequest: PullRequestUrl;
  readonly state: PullRequestState;
  readonly openedAt: Date;
  readonly closedAt: Date | null;
}

export interface OwnedPullRequest {
  readonly pullRequest: PullRequestUrl;
  readonly state: PullRequestState;
  readonly openedAt: Date;
  readonly closedAt: Date | null;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId;
  readonly teamId: TeamId;
  readonly firstReviewAt: Date | null;
}

export interface TaskOpeningFact {
  readonly by: UserId | null;
  readonly at: Date;
}

export interface RunFactParts {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly end: RunEnd;
  readonly supersededAt: Date | null;
  readonly followedAt: Date | null;
  readonly checks: CheckVerdict | null;
  readonly checkedAt: Date | null;
  readonly actions: RunActions;
  readonly approvalAnsweredAt: Date | null;
  readonly usage: RunUsage | null;
  readonly passed: StationPass | null;
  readonly tools: RunTools | null;
  readonly dismissals: readonly Dismissal[];
  readonly memories: RunMemories;
  readonly opening: TaskOpeningFact | null;
  readonly pullRequest: RunPullRequest | null;
}

const knownBy =
  (at: Date) =>
  (when: Date | null | undefined): when is Date =>
    when !== null && when !== undefined && when.getTime() <= at.getTime();

const pullRequestAsOf = (
  pullRequest: RunPullRequest | null,
  at: Date,
): RunPullRequest | null => {
  const known = knownBy(at);

  if (!pullRequest || !known(pullRequest.openedAt)) {
    return null;
  }

  const closed = pullRequest.state !== 'open' && known(pullRequest.closedAt);

  return {
    pullRequest: pullRequest.pullRequest,
    state: closed ? pullRequest.state : 'open',
    openedAt: pullRequest.openedAt,
    closedAt: closed ? pullRequest.closedAt : null,
  };
};

export class RunFact implements RunFactParts {
  readonly runId!: RunId;
  readonly workspaceId!: WorkspaceId;
  readonly end!: RunEnd;
  readonly supersededAt!: Date | null;
  readonly followedAt!: Date | null;
  readonly checks!: CheckVerdict | null;
  readonly checkedAt!: Date | null;
  readonly actions!: RunActions;
  readonly approvalAnsweredAt!: Date | null;
  readonly usage!: RunUsage | null;
  readonly passed!: StationPass | null;
  readonly tools!: RunTools | null;
  readonly dismissals!: readonly Dismissal[];
  readonly memories!: RunMemories;
  readonly opening!: TaskOpeningFact | null;
  readonly pullRequest!: RunPullRequest | null;

  private constructor(parts: RunFactParts) {
    Object.assign(this, parts);
  }

  static of(parts: RunFactParts): RunFact {
    if ((parts.checks === null) !== (parts.checkedAt === null)) {
      throw new InvalidOutcomeError('must say when its change was checked');
    }
    if (
      parts.followedAt !== null &&
      parts.followedAt.getTime() < parts.end.endedAt.getTime()
    ) {
      throw new InvalidOutcomeError(
        'can be followed only by a run that ended after it',
      );
    }

    return new RunFact(parts);
  }

  get taskId(): TaskId {
    return this.end.location.taskId;
  }

  get ending(): RunEnding {
    return effectiveEndingOf(this.end, this.supersededAt);
  }

  get ran(): boolean {
    return this.end.ran;
  }

  get size(): RunSize | null {
    return sizeOf(this.usage);
  }

  get disposition(): RunDisposition {
    return dispositionOf(this.classified);
  }

  get resolution(): RunResolution {
    return resolutionOf(this.classified);
  }

  private get classified(): ClassifiedRun {
    return {
      ending: this.ending,
      decidingAction: this.actions.decidingAction,
      taskMerged: this.taskMerged,
      followed: this.followedAt !== null,
      asked: this.end.asked,
      answered: this.actions.answer !== null,
      approvalAnswered: this.approvalAnsweredAt !== null,
      passed: this.passed !== null,
    };
  }

  get taskMerged(): boolean {
    return this.pullRequest?.state === 'merged';
  }

  get humanLabel(): HumanLabel | null {
    return HumanLabel.of(this.classified);
  }

  get leftWork(): boolean {
    return leftWork(this.ending);
  }

  get taskPullRequestsFinished(): boolean {
    return this.pullRequest !== null && this.pullRequest.state !== 'open';
  }

  asOf(at: Date): RunFact | null {
    const known = knownBy(at);

    if (!known(this.end.endedAt)) {
      return null;
    }

    const checked = known(this.checkedAt);

    return new RunFact({
      // oxlint-disable-next-line typescript/no-misused-spread -- rebuilds it from its fields
      ...this,
      supersededAt: known(this.supersededAt) ? this.supersededAt : null,
      followedAt: known(this.followedAt) ? this.followedAt : null,
      checks: checked ? this.checks : null,
      checkedAt: checked ? this.checkedAt : null,
      actions: this.actions.knownBy(known),
      approvalAnsweredAt: known(this.approvalAnsweredAt)
        ? this.approvalAnsweredAt
        : null,
      passed: known(this.passed?.at) ? this.passed : null,
      pullRequest: pullRequestAsOf(this.pullRequest, at),
    });
  }
}
