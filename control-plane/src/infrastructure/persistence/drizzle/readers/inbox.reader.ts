import type {
  InboxItemSummary,
  InboxReaderPort,
} from '@application/ports/inbox-reader.port';
import {
  conversationsOf,
  notesIn,
  stillOpen,
} from '@domain/services/conversations';
import { anyUnread } from '@domain/services/unread';
import { ConversationId } from '@domain/value-objects/conversation-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  attachmentsFor,
  attachmentsOf,
  briefingsFor,
  stationsPerLine,
  trailsFor,
} from '@infrastructure/persistence/drizzle/readers/task-trail';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  line,
  station,
} from '@infrastructure/persistence/drizzle/schemas/line.schema';
import { task } from '@infrastructure/persistence/drizzle/schemas/task.schema';
import {
  workspace,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

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

    const raised = alias(station, 'raised');

    const rows = await this.db
      .select({
        taskId: task.id,
        teamId: factory.teamId,
        title: task.title,
        description: task.description,
        lineId: line.id,
        raisedStation: raised.name,
        raisedColor: raised.color,
        raisedPosition: raised.position,
        standsAtStation: station.name,
        standsAtColor: station.color,
        standsAtPosition: station.position,
        createdAt: task.createdAt,
        working: task.currentRunId,
      })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .leftJoin(raised, eq(raised.id, task.raisedAtStationId))
      .where(
        and(
          eq(task.workspaceId, visible.id),
          eq(task.assigneeId, userId.value),
        ),
      );

    if (rows.length === 0) {
      return [];
    }

    const trail = await trailsFor(
      this.db,
      rows.map((row) => row.taskId),
    );
    const attached = await attachmentsFor(
      this.db,
      rows.map((row) => row.taskId),
    );
    const held = await stationsPerLine(
      this.db,
      rows.map((row) => row.lineId),
    );

    const given = await briefingsFor(
      this.db,
      [...trail.values()].flatMap((told) =>
        told.flatMap((note) => (note.runId ? [note.runId] : [])),
      ),
    );

    const items: InboxItemSummary[] = [];

    for (const row of rows) {
      const told = trail.get(row.taskId) ?? [];

      for (const conversation of conversationsOf(
        told.map((each) => each.kind),
      )) {
        const note = told[conversation.from];

        if (!note) {
          continue;
        }

        const notes = notesIn(conversation, told);
        const last = notes[notes.length - 1];

        items.push({
          id: ConversationId.of({
            taskId: TaskId.of(row.taskId),
            from: note.position,
          }).value,
          taskId: row.taskId,
          teamId: row.teamId,
          title: row.title,
          description: row.description,
          attachments: attachmentsOf(attached, row.taskId).own,
          station: note.station,
          stationColor: note.stationColor,
          stationPosition: note.stationPosition,
          stationCount: held.get(row.lineId) ?? 1,
          raisedAt: {
            name: row.raisedStation ?? note.station,
            color: row.raisedColor ?? note.stationColor,
            position: row.raisedPosition ?? note.stationPosition,
          },
          standsAt: {
            name: row.standsAtStation,
            color: row.standsAtColor,
            position: row.standsAtPosition,
          },
          createdAt: row.createdAt,
          askedAt: last?.at ?? note.at,
          resolved: !stillOpen(conversation),
          working: stillOpen(conversation) && row.working !== null,
          runId: stillOpen(conversation) ? row.working : null,
          unread: anyUnread(notes),
          briefing: (note.runId && given.get(note.runId)) || null,
          notes,
        });
      }
    }

    return items.sort((one, other) => +other.askedAt - +one.askedAt);
  }
}
