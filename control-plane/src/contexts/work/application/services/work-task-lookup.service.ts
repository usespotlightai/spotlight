import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type {
  TaskLookupReaderPort,
  TaskLookupReading,
  TaskNoteReading,
} from '@work/application/ports/task-lookup-reader.port';
import type {
  TaskLookup,
  TaskNoteView,
  WorkTaskLookupPort,
} from '@work/application/ports/work-task-lookup.port';
import { correlatedTask } from '@work/application/services/correlated-task';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';

const noteViewsOf = (note: TaskNoteReading): TaskNoteView[] => {
  const by = note.voice.isPerson
    ? 'person'
    : note.voice.isWorld
      ? 'world'
      : null;
  const text = note.body.trim();

  return by && text
    ? [
        {
          position: note.position,
          by,
          author: note.voice.author?.value ?? null,
          text,
        },
      ]
    : [];
};

export class WorkTaskLookup implements WorkTaskLookupPort {
  constructor(
    private readonly readings: TaskLookupReaderPort,
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
  ) {}

  async task(taskId: TaskId): Promise<TaskLookup | null> {
    const task = await this.readings.find(taskId);

    return task ? this.lookup(task) : null;
  }

  async taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskLookup | null> {
    const task =
      (await this.taskWithMark(workspaceId, Mark.pullRequest(pullRequest))) ??
      (await this.taskWithMark(workspaceId, Mark.review(pullRequest)));

    return task
      ? this.lookup({
          id: task.id,
          workspaceId: task.workspaceId,
          stationId: task.stationId,
          pullRequestLink: task.pullRequestLink,
          laterPullRequests: task.laterPullRequests.map((each) => each.url),
          currentRunId: task.currentRunId,
        })
      : null;
  }

  async notesOf(taskId: TaskId): Promise<readonly TaskNoteView[] | null> {
    return (await this.readings.notesOf(taskId))?.flatMap(noteViewsOf) ?? null;
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

  private async lookup(task: TaskLookupReading): Promise<TaskLookup> {
    const line = await this.lines.findByStation(task.stationId);

    return {
      id: task.id,
      workspaceId: task.workspaceId,
      teamId: line?.teamId ?? null,
      pullRequest: task.pullRequestLink?.url ?? null,
      pullRequests: task.pullRequestLink
        ? [task.pullRequestLink.url, ...task.laterPullRequests]
        : [],
      reviewing: task.pullRequestLink?.reviews ?? false,
      fromOutside: task.pullRequestLink?.fromOutside ?? false,
      currentRunId: task.currentRunId,
    };
  }
}
