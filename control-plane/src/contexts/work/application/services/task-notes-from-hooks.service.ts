import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { ProcessedEventsPort } from '@work/application/ports/processed-events.port';
import type {
  HookFailureNotice,
  HookFailureReport,
  TaskNotesFromHooksPort,
} from '@work/application/ports/task-notes-from-hooks.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import type { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const ATTEMPTS = 3;

const firedAtIn = (line: LineMap, stationKey: string): Station | null => {
  const key = StationKey.parsed(stationKey);

  return key ? line.stationKeyed(key) : null;
};

export class TaskNotesFromHooks implements TaskNotesFromHooksPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly processed: ProcessedEventsPort,
    private readonly placements: TaskPlacementsPort,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async noted(
    taskId: string,
    body: string,
    hook: string,
    receivedAs: string | null,
  ): Promise<boolean> {
    const noteBody = TaskNoteBody.fromHook(hook, body);

    return this.retried(async () => {
      const task = await this.tasks.find(TaskId.of(taskId));

      if (!task) {
        return false;
      }

      if (
        receivedAs &&
        !(await this.processed.markProcessed(
          task.workspaceId,
          receivedAs,
          this.clock.now(),
        ))
      ) {
        return true;
      }

      const line = await this.lines.findByStation(task.stationId);

      await this.tasks.save(
        task.addMessage({
          line,
          body: noteBody,
          at: this.clock.now(),
          voice: Voice.station(),
        }),
      );

      return true;
    });
  }

  async failed(report: HookFailureReport): Promise<HookFailureNotice> {
    return this.retried(async () => {
      const task = await this.tasks.find(TaskId.of(report.taskId));
      const line = task ? await this.lines.findByStation(task.stationId) : null;

      if (!task || !line) {
        return 'gone';
      }

      if (
        await this.processed.wasProcessed(task.workspaceId, report.receivedAs)
      ) {
        return 'reported';
      }

      const firedAt = firedAtIn(line, report.stationKey);

      if (task.supersedesHookFailureAt(firedAt?.id ?? null)) {
        return 'superseded';
      }

      if (
        !(await this.processed.markProcessed(
          task.workspaceId,
          report.receivedAs,
          this.clock.now(),
        ))
      ) {
        return 'reported';
      }

      const failed = task.failed(
        TaskFailure.fromHook(report.hook, report.code),
        {
          line,
          body: TaskNoteBody.fromHook(report.hook, report.reason),
          at: this.clock.now(),
          voice: Voice.station(),
        },
        null,
        line,
        await this.deferredMoveRank(task),
      );
      const runId = failed.wantsRun(line)
        ? await this.dispatch.runIdFor({ task: failed, line })
        : null;

      await this.tasks.save(runId ? failed.assignRun(runId, line) : failed);

      return 'reported';
    });
  }

  private async deferredMoveRank(task: Task): Promise<TaskRank | null> {
    const to = task.deferredMoveTo;

    return to
      ? Placement.entering(
          'deferred',
          (await this.placements.placementsAt(to)).map((each) => each.rank),
        )
      : null;
  }

  async movedOn(taskId: string, stationKey: string): Promise<boolean> {
    const task = await this.tasks.find(TaskId.of(taskId));
    const line = task ? await this.lines.findByStation(task.stationId) : null;
    const firedAt = line ? firedAtIn(line, stationKey) : null;

    return !task || task.supersedesHookFailureAt(firedAt?.id ?? null);
  }

  private async retried<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.transaction.inTransaction(work);
      } catch (error) {
        if (
          !(error instanceof TaskVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
