import type {
  TaskNoteSummary,
  TaskReaderPort,
  TaskSummary,
} from '@application/ports/task-reader.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  attachmentsFor,
  attachmentsOf,
  awaitedReviewsFor,
} from '@infrastructure/persistence/drizzle/readers/task-trail';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  line,
  station,
} from '@infrastructure/persistence/drizzle/schemas/line.schema';
import {
  task,
  taskNote,
} from '@infrastructure/persistence/drizzle/schemas/task.schema';
import {
  team,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const assigneeUser = alias(user, 'assignee_user');

const setupNote = alias(taskNote, 'setup_note');

@Injectable()
export class DrizzleTaskReader implements TaskReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTeamMember(
    teamId: TeamId,
    userId: UserId,
  ): Promise<TaskSummary[] | null> {
    const [visible] = await this.db
      .select({ id: team.id })
      .from(team)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, team.workspaceId),
          eq(workspaceMember.userId, userId.value),
        ),
      )
      .where(eq(team.id, teamId.value))
      .limit(1);

    if (!visible) {
      return null;
    }

    const rows = await this.db
      .select({
        id: task.id,
        stationId: task.stationId,
        title: task.title,
        description: task.description,
        createdAt: task.createdAt,
        currentRunId: task.currentRunId,
        pullRequest: task.pullRequest,
        raisedById: user.id,
        raisedByName: user.name,
        raisedByImage: user.image,
        assigneeId: assigneeUser.id,
        assigneeName: assigneeUser.name,
        assigneeImage: assigneeUser.image,
      })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .leftJoin(user, eq(user.id, task.raisedById))
      .leftJoin(assigneeUser, eq(assigneeUser.id, task.assigneeId))
      .leftJoin(
        setupNote,
        and(eq(setupNote.taskId, task.id), eq(setupNote.form, 'setup')),
      )
      .where(and(eq(factory.teamId, teamId.value), isNull(setupNote.taskId)))
      .orderBy(task.rank);

    const [notes, awaited, attached] = await Promise.all([
      this.latestNotes(rows.map((row) => row.id)),
      awaitedReviewsFor(
        this.db,
        rows.map((row) => row.id),
      ),
      attachmentsFor(
        this.db,
        rows.map((row) => row.id),
      ),
    ]);

    return rows.map(
      ({
        currentRunId,
        raisedById,
        raisedByName,
        raisedByImage,
        assigneeId,
        assigneeName,
        assigneeImage,
        ...rest
      }) => ({
        ...rest,
        attachments: attachmentsOf(attached, rest.id).own,
        running: currentRunId !== null,
        awaitingReview: awaited.has(rest.id)
          ? { conversationId: awaited.get(rest.id) as string }
          : null,
        raisedBy: raisedById
          ? {
              id: raisedById,
              name: raisedByName ?? '',
              image: raisedByImage,
            }
          : null,
        assignee: assigneeId
          ? {
              id: assigneeId,
              name: assigneeName ?? '',
              image: assigneeImage,
            }
          : null,
        note: notes.get(rest.id) ?? null,
      }),
    );
  }

  // Newest first, so the first one seen for a task is the one that stands.
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
