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
import type { TaskRepository } from '@work/domain/repositories/task.repository';

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
      (await this.tasks.owningPullRequest(workspaceId, pullRequest)) ??
      (await this.tasks.reviewingPullRequest(workspaceId, pullRequest));

    return task
      ? this.lookup({
          id: task.id,
          workspaceId: task.workspaceId,
          stationId: task.stationId,
          reviewedPullRequest: task.reviewedPullRequest,
          pullRequests: task.pullRequests,
          openPullRequests: task.openPullRequests,
          currentRunId: task.currentRunId,
        })
      : null;
  }

  async notesOf(taskId: TaskId): Promise<readonly TaskNoteView[] | null> {
    return (await this.readings.notesOf(taskId))?.flatMap(noteViewsOf) ?? null;
  }

  private async lookup(task: TaskLookupReading): Promise<TaskLookup> {
    const line = await this.lines.findByStation(task.stationId);

    return {
      id: task.id,
      workspaceId: task.workspaceId,
      teamId: line?.teamId ?? null,
      pullRequests: task.pullRequests,
      openPullRequests: task.openPullRequests,
      reviewedPullRequest: task.reviewedPullRequest?.url ?? null,
      fromOutside: task.reviewedPullRequest?.fromOutside ?? false,
      currentRunId: task.currentRunId,
    };
  }
}
