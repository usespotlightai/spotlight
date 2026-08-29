import type {
  InboxItemSummary,
  InboxReaderPort,
} from '@application/ports/inbox-reader.port';
import type { TaskNoteDto } from '@application/dto/task.dto';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
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
  workspace,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleInboxReader implements InboxReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForWorkspaceMember(
    slug: WorkspaceSlug,
    userId: UserId,
  ): Promise<InboxItemSummary[] | null> {
    const [visible] = await this.db
      .select({ id: workspace.id })
      .from(workspace)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, workspace.id),
          eq(workspaceMember.userId, userId.value),
        ),
      )
      .where(eq(workspace.slug, slug.value))
      .limit(1);

    if (!visible) {
      return null;
    }

    const rows = await this.db
      .select({
        taskId: task.id,
        teamId: factory.teamId,
        title: task.title,
        description: task.description,
        station: station.name,
        stationColor: station.color,
        lastWrittenAt: task.updatedAt,
      })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(assemblyLine, eq(assemblyLine.id, station.assemblyLineId))
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .where(
        and(
          eq(task.workspaceId, visible.id),
          eq(task.awaitingReview, true),
        ),
      )
      .orderBy(asc(task.updatedAt));

    const trail = await this.notesFor(rows.map((row) => row.taskId));

    return rows.map(({ lastWrittenAt, ...row }) => {
      const told = trail.get(row.taskId);

      return {
        ...row,
        notes: told?.notes ?? [],
        askedAt: told?.askedAt ?? lastWrittenAt,
      };
    });
  }

  private async notesFor(taskIds: string[]) {
    const trail = new Map<
      string,
      { notes: TaskNoteDto[]; askedAt: Date }
    >();

    if (taskIds.length === 0) {
      return trail;
    }

    const rows = await this.db
      .select({
        taskId: taskNote.taskId,
        position: taskNote.position,
        station: taskNote.station,
        body: taskNote.body,
        at: taskNote.at,
      })
      .from(taskNote)
      .where(inArray(taskNote.taskId, taskIds))
      .orderBy(asc(taskNote.position));

    for (const row of rows) {
      const told = trail.get(row.taskId) ?? { notes: [], askedAt: row.at };
      told.notes.push({
        position: row.position,
        station: row.station,
        body: row.body,
      });
      // Ordered oldest first, so the last one seen is when it last spoke.
      told.askedAt = row.at;
      trail.set(row.taskId, told);
    }

    return trail;
  }
}
