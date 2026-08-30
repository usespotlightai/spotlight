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
  assemblyLine,
  station,
} from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  task,
  taskNote,
} from '@infrastructure/persistence/drizzle/schemas/task.schema';
import {
  team,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';

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
        awaitingReview: task.awaitingReview,
      })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(assemblyLine, eq(assemblyLine.id, station.assemblyLineId))
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .where(eq(factory.teamId, teamId.value))
      .orderBy(task.rank);

    const notes = await this.latestNotes(rows.map((row) => row.id));

    return rows.map(({ currentRunId, ...rest }) => ({
      ...rest,
      running: currentRunId !== null,
      note: notes.get(rest.id) ?? null,
    }));
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
