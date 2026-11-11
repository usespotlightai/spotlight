import type { WorkPort } from '@change-review/application/ports/work.port';
import type {
  PullRequestReaction,
  PullRequestReactionsPort,
  ReactedTo,
} from '@github/application/ports/pull-request-reactions.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const REVIEWING_REACTION: PullRequestReaction = 'eyes';

// Deliveries retry out of order. Each one reads the current run of the task again. It does not trust the order in which it received them.
export class SignalReviewing {
  constructor(
    private readonly work: WorkPort,
    private readonly connections: WorkspaceConnectionsPort,
    private readonly reactions: PullRequestReactionsPort,
  ) {}

  async began(taskId: TaskId, runId: RunId): Promise<void> {
    const reviewed = await this.reviewing(taskId);

    if (reviewed?.currentRun?.equals(runId) && (await this.stillGoing(runId))) {
      for (const on of reviewed.on) {
        await this.reactions.react(on, REVIEWING_REACTION);
      }
    }
  }

  async ended(taskId: TaskId, runId: RunId): Promise<void> {
    const reviewed = await this.reviewing(taskId);

    if (!reviewed) {
      return;
    }

    const next = reviewed.currentRun;

    if (next && !next.equals(runId) && (await this.stillGoing(next))) {
      return;
    }

    for (const on of reviewed.on) {
      await this.reactions.remove(on, REVIEWING_REACTION);
    }
  }

  private async stillGoing(runId: RunId): Promise<boolean> {
    const run = await this.work.run(runId);

    return run !== null && !run.ended;
  }

  private async reviewing(taskId: TaskId): Promise<{
    on: readonly ReactedTo[];
    currentRun: RunId | null;
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
      currentRun: task.currentRunId,
    };
  }
}
