import type { ReviewingLocksPort } from '@change-review/application/ports/reviewing-locks.port';
import type {
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { showsReviewing } from '@change-review/domain/services/reviewing-reaction';
import type {
  PullRequestReaction,
  PullRequestReactionsPort,
  ReactedTo,
} from '@github/application/ports/pull-request-reactions.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const REVIEWING_REACTION: PullRequestReaction = 'eyes';

const SETTLE_ROUNDS = 3;

export class SignalReviewing {
  constructor(
    private readonly work: WorkPort,
    private readonly connections: WorkspaceConnectionsPort,
    private readonly reactions: PullRequestReactionsPort,
    private readonly locks: ReviewingLocksPort,
  ) {}

  async signalRun(runId: RunId): Promise<void> {
    const run = await this.work.run(runId);

    if (run?.taskId) {
      await this.signal(run.taskId);
    }
  }

  signal(taskId: TaskId): Promise<void> {
    return this.locks.signallingFor(taskId, () => this.settle(taskId));
  }

  private async settle(taskId: TaskId): Promise<void> {
    let shown: boolean | null = null;

    for (let round = 0; round < SETTLE_ROUNDS; round++) {
      const reviewed = await this.reviewing(taskId);

      if (!reviewed) {
        return;
      }

      const wanted = showsReviewing(reviewed.current);

      if (wanted === shown) {
        return;
      }

      for (const on of reviewed.on) {
        await (wanted
          ? this.reactions.react(on, REVIEWING_REACTION)
          : this.reactions.remove(on, REVIEWING_REACTION));
      }

      shown = wanted;
    }
  }

  private async reviewing(taskId: TaskId): Promise<{
    on: readonly ReactedTo[];
    current: RunForReview | null;
  } | null> {
    const task = await this.work.task(taskId);

    if (
      !task?.reviewedPullRequest ||
      !(await this.connections.isConnected(task.workspaceId))
    ) {
      return null;
    }

    return {
      on: [
        {
          workspaceId: task.workspaceId,
          pullRequest: task.reviewedPullRequest,
        },
      ],
      current: task.currentRunId
        ? await this.work.run(task.currentRunId)
        : null,
    };
  }
}
