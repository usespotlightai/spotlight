import type {
  InboxItemSummary,
  InboxNote,
  InboxReaderPort,
} from '@application/ports/inbox-reader.port';
import { stretchesOf } from '@domain/services/stretches';
import { anyUnread } from '@domain/services/unread';
import { StretchId } from '@domain/value-objects/stretch-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  assemblyLine,
  station,
} from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
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
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

/** What a station whose name no note answers to any more is drawn in. */
const DEFAULT_STATION_COLOR = '#a3a8b0';

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

    // A task raised before this was recorded says nothing about where, so it
    // falls back to where it stands.
    const raised = alias(station, 'raised');

    const rows = await this.db
      .select({
        taskId: task.id,
        teamId: factory.teamId,
        title: task.title,
        description: task.description,
        lineId: assemblyLine.id,
        raisedStation: raised.name,
        raisedColor: raised.color,
        raisedPosition: raised.position,
        createdAt: task.createdAt,
        working: task.currentRunId,
      })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(assemblyLine, eq(assemblyLine.id, station.assemblyLineId))
      .innerJoin(factory, eq(factory.id, assemblyLine.factoryId))
      .leftJoin(raised, eq(raised.id, task.raisedAtStationId))
      // An inbox is one person's, not the workspace's.
      .where(
        and(
          eq(task.workspaceId, visible.id),
          eq(task.raisedById, userId.value),
        ),
      );

    if (rows.length === 0) {
      return [];
    }

    const trail = await this.notesFor(rows.map((row) => row.taskId));
    const held = await this.stationsPerLine(rows.map((row) => row.lineId));

    const items: InboxItemSummary[] = [];

    for (const row of rows) {
      const told = trail.get(row.taskId) ?? [];

      // Where the stretches are is the domain's to say, not a reader's.
      for (const stretch of stretchesOf(told.map((each) => each.kind))) {
        const note = told[stretch.from];

        if (!note) {
          continue;
        }

        const notes = told.slice(
          stretch.from,
          stretch.to === null ? undefined : stretch.to + 1,
        );
        const last = notes[notes.length - 1];

        items.push({
          id: StretchId.of({
            taskId: TaskId.of(row.taskId),
            from: note.position,
          }).value,
          taskId: row.taskId,
          teamId: row.teamId,
          title: row.title,
          description: row.description,
          station: note.station,
          stationColor: note.stationColor,
          stationPosition: note.stationPosition,
          stationCount: held.get(row.lineId) ?? 1,
          raisedAt: {
            station: row.raisedStation ?? note.station,
            stationColor: row.raisedColor ?? note.stationColor,
            stationPosition: row.raisedPosition ?? note.stationPosition,
          },
          createdAt: row.createdAt,
          askedAt: last?.at ?? note.at,
          resolved: stretch.to !== null,
          // Only what is still open can be being worked on.
          working: stretch.to === null && row.working !== null,
          unread: anyUnread(notes),
          notes,
        });
      }
    }

    // Newest first: what arrived while you were away is what you have not
    // seen, and an inbox that buries it reads as empty.
    return items.sort((one, other) => +other.askedAt - +one.askedAt);
  }

  /** How many stations each line holds, which a place is a share of. */
  private async stationsPerLine(
    lineIds: string[],
  ): Promise<Map<string, number>> {
    const held = new Map<string, number>();

    if (lineIds.length === 0) {
      return held;
    }

    const rows = await this.db
      .select({ lineId: station.assemblyLineId, held: count() })
      .from(station)
      .where(inArray(station.assemblyLineId, lineIds))
      .groupBy(station.assemblyLineId);

    for (const row of rows) {
      held.set(row.lineId, row.held);
    }

    return held;
  }

  private async notesFor(taskIds: string[]): Promise<Map<string, InboxNote[]>> {
    const trail = new Map<string, InboxNote[]>();

    if (taskIds.length === 0) {
      return trail;
    }

    // A note keeps the station's name, not its identity, so the station that
    // said it is found by name within the line the task stands in.
    const spoke = alias(station, 'spoke');

    const rows = await this.db
      .select({
        taskId: taskNote.taskId,
        position: taskNote.position,
        station: taskNote.station,
        stationColor: spoke.color,
        stationPosition: spoke.position,
        runId: taskNote.runId,
        kind: taskNote.kind,
        readAt: taskNote.readAt,
        body: taskNote.body,
        at: taskNote.at,
        authorId: user.id,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(taskNote)
      .innerJoin(task, eq(task.id, taskNote.taskId))
      .innerJoin(station, eq(station.id, task.stationId))
      .leftJoin(
        spoke,
        and(
          eq(spoke.assemblyLineId, station.assemblyLineId),
          eq(spoke.name, taskNote.station),
        ),
      )
      .leftJoin(user, eq(user.id, taskNote.authorId))
      .where(inArray(taskNote.taskId, taskIds))
      .orderBy(asc(taskNote.taskId), asc(taskNote.position));

    for (const row of rows) {
      const told = trail.get(row.taskId) ?? [];

      told.push({
        position: row.position,
        station: row.station,
        // A station that has since been renamed or removed leaves a note
        // nothing answers to, so it takes the line's own grey.
        stationColor: row.stationColor ?? DEFAULT_STATION_COLOR,
        stationPosition: row.stationPosition ?? 0,
        runId: row.runId,
        kind: row.kind ?? 'passed',
        body: row.body,
        at: row.at,
        readAt: row.readAt,
        author: row.authorId
          ? {
              id: row.authorId,
              name: row.authorName ?? '',
              image: row.authorImage,
            }
          : null,
      });

      trail.set(row.taskId, told);
    }

    return trail;
  }
}
