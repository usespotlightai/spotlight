import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { handedToRun } from '@work/application/services/handed-to-run';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

const SAVE_ATTEMPTS = 3;

type Release = (task: Task, line: LineMap) => Promise<Task>;

// Each task that waits for a completed or deleted task, in a transaction of its own.
export class ReleaseBlockedTasks {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: Pick<LineMapsPort, 'findByStation'>,
    private readonly placements: TaskPlacementsPort,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  onFinished(event: TaskFinished): Promise<void> {
    return this.releaseWaitingFor(
      event.workspaceId,
      event.taskId,
      async (task, line) => {
        const entry = line.entry;
        const ranks = entry
          ? (await this.placements.placementsAt(entry.id)).map(
              (each) => each.rank,
            )
          : [];
        const next = task.blockerFinished(
          event.taskId,
          line,
          Placement.entering('passed-on', ranks),
          this.clock.now(),
        );

        return next.stationId.equals(task.stationId)
          ? next
          : handedToRun(this.dispatch, next, line);
      },
    );
  }

  onDeleted(event: TaskDeleted): Promise<void> {
    return this.releaseWaitingFor(
      event.workspaceId,
      event.taskId,
      async (task, line) =>
        task.blockerDeleted(event.taskId, line, this.clock.now()),
    );
  }

  private async releaseWaitingFor(
    workspaceId: WorkspaceId,
    blocker: TaskId,
    release: Release,
  ): Promise<void> {
    const errors: unknown[] = [];

    for (const waiting of await this.tasks.waitingFor(workspaceId, blocker)) {
      await this.released(waiting.id, release).catch((error: unknown) => {
        errors.push(error);
      });
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Could not release ${errors.length} tasks that wait for task ${blocker.value}`,
      );
    }
  }

  private async released(taskId: TaskId, release: Release): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.transaction.inTransaction(async () => {
          const current = await this.tasks.find(taskId);
          const line = current
            ? await this.lines.findByStation(current.stationId)
            : null;

          if (!current || !line) {
            return;
          }

          const next = await release(current, line);

          if (next !== current) {
            await this.tasks.save(next);
          }
        });

        return;
      } catch (error) {
        if (
          !(error instanceof TaskVersionConflictError) ||
          attempt >= SAVE_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
