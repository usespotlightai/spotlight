import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { after, pageOf } from '@platform/persistence/drizzle/keyset';
import {
  RUN_PROGRESS,
  type RunProgressPort,
} from '@runs/application/ports/run-progress.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Page } from '@work/application/dto/page.dto';
import type {
  TaskListing,
  TaskNoteSummary,
  TaskReaderPort,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import { progressOfCurrentRuns } from '@work/infrastructure/persistence/drizzle/readers/current-progress';
import { cursorOf } from '@work/infrastructure/persistence/drizzle/readers/page-cursor';
import {
  attachmentsFor,
  attachmentsOf,
  awaitedReviewsFor,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import {
  task,
  taskNote,
  taskPullRequest,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { and, asc, desc, eq, inArray, ne, type SQL } from 'drizzle-orm';

@Injectable()
export class DrizzleTaskReader implements TaskReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
    @Inject(RUN_PROGRESS) private readonly progress: RunProgressPort,
  ) {}

  async listForTeam(
    teamId: TeamId,
    listing: TaskListing,
  ): Promise<Page<TaskSummary>> {
    if (listing.state === 'board') {
      return {
        items: await this.summariesIn(
          teamId,
          and(ne(workStation.kind, 'completed'), eq(task.isSetup, false)),
          null,
        ),
        next: null,
      };
    }

    const { page } = listing;
    const before = cursorOf(page.before);
    const rows = await this.summariesIn(
      teamId,
      and(
        eq(workStation.kind, 'completed'),
        eq(task.isSetup, false),
        listing.lineId ? eq(workStation.lineId, listing.lineId) : undefined,
        before ? after(task.rank, task.id, before) : undefined,
      ),
      page.limit + 1,
    );

    return pageOf(rows, page.limit, (row) => ({ key: row.rank, id: row.id }));
  }

  async findInTeam(
    teamId: TeamId,
    taskId: TaskId,
  ): Promise<TaskSummary | null> {
    const [found] = await this.summariesIn(
      teamId,
      eq(task.id, taskId.value),
      1,
    );

    return found ?? null;
  }

  private async summariesIn(
    teamId: TeamId,
    narrowedTo: SQL | undefined,
    limit: number | null,
  ): Promise<(TaskSummary & { readonly rank: string })[]> {
    const listed = this.db
      .select({
        id: task.id,
        rank: task.rank,
        stationId: task.stationId,
        revision: task.revision,
        title: task.title,
        description: task.description,
        createdAt: task.createdAt,
        currentRunId: task.currentRunId,
        reviewedPullRequest: task.reviewedPullRequest,
        createdById: task.createdById,
        assigneeId: task.assigneeId,
      })
      .from(task)
      .innerJoin(workStation, eq(workStation.stationId, task.stationId))
      .where(and(eq(workStation.teamId, teamId.value), narrowedTo))
      .orderBy(asc(task.rank), asc(task.id))
      .$dynamic();
    const rows = await (limit === null ? listed : listed.limit(limit));

    const [notes, pulled, awaited, attached, people, progressOf] =
      await Promise.all([
        this.latestNotes(rows.map((row) => row.id)),
        this.ownedPullRequests(rows.map((row) => row.id)),
        awaitedReviewsFor(
          this.db,
          rows.map((row) => row.id),
        ),
        attachmentsFor(
          this.db,
          rows.map((row) => row.id),
        ),
        this.people.findMany(
          rows.flatMap((row) =>
            [row.createdById, row.assigneeId].flatMap((id) =>
              id ? [UserId.of(id)] : [],
            ),
          ),
        ),
        progressOfCurrentRuns(
          this.progress,
          rows.map((row) => row.currentRunId),
          true,
        ),
      ]);
    const person = (id: string) => ({
      id,
      name: people.get(id)?.name ?? '',
      image: people.get(id)?.image ?? null,
    });

    return rows.map(
      ({
        currentRunId,
        createdById,
        assigneeId,
        reviewedPullRequest,
        ...rest
      }) => ({
        ...rest,
        pullRequests: reviewedPullRequest
          ? [reviewedPullRequest]
          : (pulled.get(rest.id) ?? []),
        attachments: attachmentsOf(attached, rest.id).own,
        progress: awaited.has(rest.id) ? null : progressOf(currentRunId),
        awaitingReview: awaited.has(rest.id)
          ? { conversationId: awaited.get(rest.id) as string }
          : null,
        createdBy: createdById ? person(createdById) : null,
        assignee: assigneeId ? person(assigneeId) : null,
        note: notes.get(rest.id) ?? null,
      }),
    );
  }

  private async ownedPullRequests(
    taskIds: string[],
  ): Promise<Map<string, string[]>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({ taskId: taskPullRequest.taskId, url: taskPullRequest.url })
      .from(taskPullRequest)
      .where(inArray(taskPullRequest.taskId, taskIds))
      .orderBy(asc(taskPullRequest.openedAt), asc(taskPullRequest.url));
    const owned = new Map<string, string[]>();

    for (const row of rows) {
      owned.set(row.taskId, [...(owned.get(row.taskId) ?? []), row.url]);
    }

    return owned;
  }

  private async latestNotes(
    taskIds: string[],
  ): Promise<Map<string, TaskNoteSummary>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .selectDistinctOn([taskNote.taskId], {
        taskId: taskNote.taskId,
        position: taskNote.position,
        station: taskNote.station,
        body: taskNote.body,
      })
      .from(taskNote)
      .where(inArray(taskNote.taskId, taskIds))
      .orderBy(taskNote.taskId, desc(taskNote.position));

    return new Map(rows.map(({ taskId, ...note }) => [taskId, note] as const));
  }
}
