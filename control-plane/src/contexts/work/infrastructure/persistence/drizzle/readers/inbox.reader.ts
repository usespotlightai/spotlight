import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  InboxItemSummary,
  InboxReaderPort,
} from '@work/application/ports/inbox-reader.port';
import {
  conversationsOf,
  notesIn,
  stillOpen,
} from '@work/domain/services/conversations';
import { anyUnread } from '@work/domain/services/unread';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import {
  attachmentsFor,
  attachmentsOf,
  briefingsFor,
  stationsPerLine,
  trailsFor,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

@Injectable()
export class DrizzleInboxReader implements InboxReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(WORKSPACE_ACCESS) private readonly access: WorkspaceAccessPort,
    @Inject(WORKSPACE_READER) private readonly workspaces: WorkspaceReaderPort,
    @Inject(PERSON_READER) private readonly people: PersonReaderPort,
  ) {}

  async listForWorkspaceMember(
    slug: string,
    userId: UserId,
  ): Promise<InboxItemSummary[] | null> {
    const visible = await this.workspaces.identify(slug);

    if (
      !visible ||
      !(await this.access.mayView(userId, WorkspaceId.of(visible)))
    ) {
      return null;
    }

    const raised = alias(station, 'raised');

    const rows = await this.db
      .select({
        taskId: task.id,
        teamId: line.teamId,
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
      .leftJoin(raised, eq(raised.id, task.raisedAtStationId))
      .where(
        and(eq(task.workspaceId, visible), eq(task.assigneeId, userId.value)),
      );

    if (rows.length === 0) {
      return [];
    }

    const trail = await trailsFor(
      this.db,
      this.people,
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
