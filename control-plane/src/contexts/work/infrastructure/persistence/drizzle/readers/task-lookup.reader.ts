import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  TaskLookupReaderPort,
  TaskLookupReading,
  TaskNoteReading,
} from '@work/application/ports/task-lookup-reader.port';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import {
  task,
  taskNote,
  taskPullRequest,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleTaskLookupReader implements TaskLookupReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async find(taskId: TaskId): Promise<TaskLookupReading | null> {
    const [row] = await this.context.db
      .select({
        id: task.id,
        workspaceId: task.workspaceId,
        stationId: task.stationId,
        pullRequest: task.pullRequest,
        reviewing: task.reviewing,
        reviewFromOutside: task.reviewFromOutside,
        currentRunId: task.currentRunId,
      })
      .from(task)
      .where(eq(task.id, taskId.value));
    const later = row
      ? await this.context.db
          .select({ url: taskPullRequest.url })
          .from(taskPullRequest)
          .where(eq(taskPullRequest.taskId, row.id))
          .orderBy(asc(taskPullRequest.openedAt), asc(taskPullRequest.url))
      : [];

    return row
      ? {
          id: TaskId.of(row.id),
          workspaceId: WorkspaceId.of(row.workspaceId),
          stationId: StationId.of(row.stationId),
          pullRequestLink: row.pullRequest
            ? row.reviewing
              ? PullRequestLink.reviewing(PullRequestUrl.of(row.pullRequest), {
                  outside: row.reviewFromOutside,
                })
              : PullRequestLink.opened(PullRequestUrl.of(row.pullRequest))
            : null,
          laterPullRequests: later.map((each) => PullRequestUrl.of(each.url)),
          currentRunId: row.currentRunId ? RunId.of(row.currentRunId) : null,
        }
      : null;
  }

  async notesOf(taskId: TaskId): Promise<readonly TaskNoteReading[] | null> {
    const [found] = await this.context.db
      .select({ id: task.id })
      .from(task)
      .where(eq(task.id, taskId.value));

    if (!found) {
      return null;
    }

    const rows = await this.context.db
      .select({
        position: taskNote.position,
        voice: taskNote.voice,
        authorId: taskNote.authorId,
        coAuthorIds: taskNote.coAuthorIds,
        runId: taskNote.runId,
        body: taskNote.body,
      })
      .from(taskNote)
      .where(eq(taskNote.taskId, taskId.value))
      .orderBy(asc(taskNote.position));

    return rows.map((row) => ({
      position: row.position,
      voice: Voice.of({
        kind: row.voice,
        author: row.authorId,
        coAuthors: row.coAuthorIds,
        run: row.runId,
      }),
      body: row.body,
    }));
  }
}
