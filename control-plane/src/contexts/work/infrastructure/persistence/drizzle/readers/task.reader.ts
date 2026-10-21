import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  TaskNoteSummary,
  TaskReaderPort,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import { progressOfCurrentRuns } from '@work/infrastructure/persistence/drizzle/readers/current-progress';
import {
  attachmentsFor,
  attachmentsOf,
  awaitedReviewsFor,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import {
  task,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const setupNote = alias(taskNote, 'setup_note');

@Injectable()
export class DrizzleTaskReader implements TaskReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(WORKSPACE_ACCESS) private readonly access: WorkspaceAccessPort,
    @Inject(TEAM_DIRECTORY) private readonly teams: TeamDirectoryPort,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
  ) {}

  async listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<TaskSummary[] | null> {
    const visible = await this.teams.find(teamId);

    if (!visible || !(await this.access.mayView(userId, visible.workspaceId))) {
      return null;
    }

    return this.summariesIn(teamId, null);
  }

  async findForTeamMember(
    teamId: TeamId,
    userId: UserId,
    taskId: TaskId,
  ): Promise<TaskSummary | null> {
    const visible = await this.teams.find(teamId);

    if (!visible || !(await this.access.mayView(userId, visible.workspaceId))) {
      return null;
    }

    const [found] = await this.summariesIn(teamId, taskId);

    return found ?? null;
  }

  private async summariesIn(
    teamId: TeamId,
    only: TaskId | null,
  ): Promise<TaskSummary[]> {
    const rows = await this.db
      .select({
        id: task.id,
        stationId: task.stationId,
        revision: task.revision,
        title: task.title,
        description: task.description,
        createdAt: task.createdAt,
        currentRunId: task.currentRunId,
        pullRequest: task.pullRequest,
        createdById: task.createdById,
        assigneeId: task.assigneeId,
      })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .leftJoin(
        setupNote,
        and(eq(setupNote.taskId, task.id), eq(setupNote.form, 'setup')),
      )
      .where(
        and(
          eq(line.teamId, teamId.value),
          only ? eq(task.id, only.value) : isNull(setupNote.taskId),
        ),
      )
      .orderBy(task.rank);

    const [notes, awaited, attached, people, progressOf] = await Promise.all([
      this.latestNotes(rows.map((row) => row.id)),
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
        this.db,
        rows.map((row) => row.currentRunId),
      ),
    ]);
    const person = (id: string) => ({
      id,
      name: people.get(id)?.name ?? '',
      image: people.get(id)?.image ?? null,
    });

    return rows.map(({ currentRunId, createdById, assigneeId, ...rest }) => ({
      ...rest,
      attachments: attachmentsOf(attached, rest.id).own,
      progress: awaited.has(rest.id) ? null : progressOf(currentRunId),
      awaitingReview: awaited.has(rest.id)
        ? { conversationId: awaited.get(rest.id) as string }
        : null,
      createdBy: createdById ? person(createdById) : null,
      assignee: assigneeId ? person(assigneeId) : null,
      note: notes.get(rest.id) ?? null,
    }));
  }

  private async latestNotes(
    taskIds: string[],
  ): Promise<Map<string, TaskNoteSummary>> {
    const latest = new Map<string, TaskNoteSummary>();

    if (taskIds.length === 0) {
      return latest;
    }

    const rows = await this.db
      .select({
        taskId: taskNote.taskId,
        position: taskNote.position,
        station: taskNote.station,
        body: taskNote.body,
      })
      .from(taskNote)
      .where(inArray(taskNote.taskId, taskIds))
      .orderBy(desc(taskNote.position));

    for (const row of rows) {
      if (!latest.has(row.taskId)) {
        latest.set(row.taskId, {
          position: row.position,
          station: row.station,
          body: row.body,
        });
      }
    }

    return latest;
  }
}
