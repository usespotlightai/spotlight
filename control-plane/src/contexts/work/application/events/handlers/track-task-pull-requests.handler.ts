import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export class TrackTaskPullRequests {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: Pick<LineMapsPort, 'findByStation'>,
    private readonly placements: TaskPlacementsPort,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async closed(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    at: Date | null,
  ): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const task = await this.tasks.owningPullRequest(workspaceId, pullRequest);

      if (!task) {
        return;
      }

      const line = task.moveHeldTo
        ? await this.lines.findByStation(task.stationId)
        : null;
      const closed = task.pullRequestClosed(
        pullRequest,
        at ?? this.clock.now(),
        {
          line,
          ranksAtHeldMove: task.moveHeldTo
            ? (await this.placements.placementsAt(task.moveHeldTo)).map(
                (each) => each.rank,
              )
            : [],
        },
      );

      if (closed !== task) {
        await this.tasks.save(await this.dispatched(closed, task, line));
      }
    });
  }

  async reopened(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const task = await this.tasks.owningPullRequest(workspaceId, pullRequest);
      const changed = task && task.pullRequestReopened(pullRequest);

      if (changed && changed !== task) {
        await this.tasks.save(changed);
      }
    });
  }

  private async dispatched(
    closed: Task,
    task: Task,
    line: LineMap | null,
  ): Promise<Task> {
    if (!line || closed.stationId.equals(task.stationId)) {
      return closed;
    }

    return handedToRun(this.dispatch, closed, line);
  }
}
