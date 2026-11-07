import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type {
  TaskLookup,
  TaskNoteView,
  WorkTaskLookupPort,
} from '@work/application/ports/work-task-lookup.port';
import { correlatedTask } from '@work/application/services/correlated-task';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskNote } from '@work/domain/entities/task-note.entity';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';

const noteViewsOf = (note: TaskNote): TaskNoteView[] => {
  const by = note.voice.isPerson
    ? 'person'
    : note.voice.isWorld
      ? 'world'
      : null;
  const text = note.body.value.trim();

  return by && text
    ? [
        {
          position: note.position.value,
          by,
          author: note.voice.author?.value ?? null,
          text,
        },
      ]
    : [];
};

export class WorkTaskLookup implements WorkTaskLookupPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
  ) {}

  async task(taskId: TaskId): Promise<TaskLookup | null> {
    const task = await this.tasks.find(taskId);

    return task ? this.lookup(task) : null;
  }

  async taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskLookup | null> {
    const task =
      (await this.taskWithMark(workspaceId, Mark.pullRequest(pullRequest))) ??
      (await this.taskWithMark(workspaceId, Mark.review(pullRequest)));

    return task ? this.lookup(task) : null;
  }

  async notesOf(taskId: TaskId): Promise<readonly TaskNoteView[] | null> {
    const task = await this.tasks.find(taskId);

    return task ? task.notes.flatMap(noteViewsOf) : null;
  }

  private async taskWithMark(
    workspaceId: WorkspaceId,
    mark: Mark,
  ): Promise<Task | null> {
    const correlationKeys = CorrelationKeys.of({ marks: [mark] });

    return correlationKeys
      ? correlatedTask(this.tasks, workspaceId, correlationKeys)
      : null;
  }

  private async lookup(task: Task): Promise<TaskLookup> {
    const line = await this.lines.findByStation(task.stationId);

    return {
      id: task.id,
      workspaceId: task.workspaceId,
      teamId: line?.teamId ?? null,
      pullRequest: task.pullRequest,
      reviewing: task.reviewing,
      fromOutside: task.fromOutside,
      currentRunId: task.currentRunId,
    };
  }
}
