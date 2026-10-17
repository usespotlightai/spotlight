import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ProcessedEventsPort } from '@work/application/ports/processed-events.port';
import type {
  HookFailureNotice,
  HookFailureReport,
  TaskNotesFromHooksPort,
} from '@work/application/ports/task-notes-from-hooks.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type {
  TaskViewDto,
  TaskViewsPort,
} from '@work/application/ports/task-views.port';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import { repositoriesWorkedOn } from '@work/domain/services/task-checkouts';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import type { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const ATTEMPTS = 3;

const firedAtIn = (line: Line, stationKey: string): Station | null => {
  const key = StationKey.parsed(stationKey);

  return key ? line.stationKeyed(key) : null;
};

export class TaskViews implements TaskViewsPort, TaskNotesFromHooksPort {
  private readonly base: string;

  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly processed: ProcessedEventsPort,
    private readonly placements: TaskPlacementsPort,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    base: string,
  ) {
    this.base = base.replace(/\/+$/, '');
  }

  async of(taskId: string, runId: string | null): Promise<TaskViewDto | null> {
    const task = await this.tasks.find(TaskId.of(taskId));

    return task
      ? this.viewOf(task, runId ?? task.currentRunId?.value ?? null)
      : null;
  }

  async ofPullRequest(
    workspaceId: string,
    pullRequest: string,
  ): Promise<TaskViewDto | null> {
    const concerns = Concerns.of({
      marks: [Mark.pullRequest(PullRequestUrl.of(pullRequest))],
    });
    const task = concerns
      ? await this.tasks.findByMarks(WorkspaceId.of(workspaceId), concerns)
      : null;

    return task ? this.viewOf(task, task.currentRunId?.value ?? null) : null;
  }

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
          station:
            line?.stationAt(task.stationId)?.name ?? StationName.unknown(),
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

      if (task.movedOnFrom(firedAt?.id ?? null) || !firedAt) {
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
          station: firedAt.name,
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
      ? Placement.atTheTop(
          (await this.placements.placementsAt(to)).map((each) => each.rank),
        )
      : null;
  }

  async movedOn(taskId: string, stationKey: string): Promise<boolean> {
    const task = await this.tasks.find(TaskId.of(taskId));
    const line = task ? await this.lines.findByStation(task.stationId) : null;
    const firedAt = line ? firedAtIn(line, stationKey) : null;

    return !task || !firedAt || task.movedOnFrom(firedAt.id);
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

  private async viewOf(
    task: Task,
    runId: string | null,
  ): Promise<TaskViewDto | null> {
    const line = await this.lines.findByStation(task.stationId);

    if (!line) {
      return null;
    }

    const station = line.stationAt(task.stationId);
    const slug = await this.workspaces.slugOf(task.workspaceId.value);

    return {
      taskId: task.id.value,
      workspaceId: task.workspaceId.value,
      teamId: line.teamId.value,
      title: task.title.value,
      url: slug
        ? `${this.base}/w/${slug}/team/${line.teamId.value}/tasks/${task.id.value}`
        : '',
      line: line.key.value,
      station: station?.name.value ?? '',
      stationKey: station?.key.value ?? '',
      marks: Object.fromEntries(
        task.marks.map((mark) => [mark.kind, mark.value]),
      ),
      repositories: repositoriesWorkedOn(task, line).map((each) => each.value),
      pullRequest: task.pullRequest?.value ?? null,
      runId,
    };
  }
}
