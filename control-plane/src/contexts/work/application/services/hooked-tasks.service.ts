import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  HookedTaskDto,
  HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskMovedOnError } from '@work/domain/exceptions/task-moved-on.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const ATTEMPTS = 3;

export class HookedTasks implements HookedTasksPort, TaskNotesFromHooksPort {
  private readonly base: string;

  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly clock: ClockPort,
    base: string,
  ) {
    this.base = base.replace(/\/+$/, '');
  }

  async of(
    taskId: string,
    runId: string | null,
  ): Promise<HookedTaskDto | null> {
    const task = await this.tasks.find(TaskId.of(taskId));

    return task
      ? this.hooked(task, runId ?? task.currentRunId?.value ?? null)
      : null;
  }

  async ofPullRequest(
    workspaceId: string,
    pullRequest: string,
  ): Promise<HookedTaskDto | null> {
    const concerns = Concerns.of({
      marks: [Mark.pullRequest(PullRequestUrl.of(pullRequest))],
    });
    const task = concerns
      ? await this.tasks.holding(WorkspaceId.of(workspaceId), concerns)
      : null;

    return task ? this.hooked(task, task.currentRunId?.value ?? null) : null;
  }

  async noted(taskId: string, body: string, hook: string): Promise<boolean> {
    const said = TaskNoteBody.fromHook(hook, body);

    for (let attempt = 1; ; attempt++) {
      const task = await this.tasks.find(TaskId.of(taskId));

      if (!task) {
        return false;
      }

      const line = await this.lines.holding(task.stationId);

      try {
        await this.tasks.save(
          task.heard({
            station:
              line?.stationAt(task.stationId)?.name ?? StationName.unknown(),
            body: said,
            at: this.clock.now(),
            voice: Voice.station(),
          }),
        );

        return true;
      } catch (error) {
        if (!(error instanceof TaskMovedOnError) || attempt >= ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private async hooked(
    task: Task,
    runId: string | null,
  ): Promise<HookedTaskDto | null> {
    const line = await this.lines.holding(task.stationId);

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
      repositories: line.repositories.all.map((each) => each.value),
      pullRequest: task.pullRequest?.value ?? null,
      runId,
    };
  }
}
