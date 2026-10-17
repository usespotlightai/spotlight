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
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  InboxEntrySummary,
  InboxItemSummary,
  InboxNoticeSummary,
  InboxReaderPort,
} from '@work/application/ports/inbox-reader.port';
import {
  type AsideAccess,
  TaskAside,
} from '@work/domain/aggregates/task-aside.aggregate';
import {
  awaitsAPerson,
  conversationsOf,
  notesIn,
  stillOpen,
} from '@work/domain/services/conversations';
import { anyUnread } from '@work/domain/services/unread';
import { ASIDE_FORMS } from '@work/domain/value-objects/aside-form';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import {
  attachmentsFor,
  attachmentsOf,
  briefingsFor,
  failureIn,
  stationsPerLine,
  trailsFor,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import {
  line,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { notice } from '@work/infrastructure/persistence/drizzle/schemas/notice.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import {
  taskAside,
  taskAsideRead,
} from '@work/infrastructure/persistence/drizzle/schemas/task-aside.schema';
import { and, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const FORMS_FOR_TEAM_READERS = ASIDE_FORMS.filter(
  (form) => TaskAside.requiredAccess(form) === 'readsTeamOutcomes',
);

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
    noticesResolvedSince: Date,
  ): Promise<InboxEntrySummary[] | null> {
    const visible = await this.workspaces.identify(slug);

    if (
      !visible ||
      !(await this.access.mayView(userId, WorkspaceId.of(visible)))
    ) {
      return null;
    }

    const items: InboxEntrySummary[] = await this.conversationsIn(
      await this.assignedTo(visible, userId),
    );

    items.push(...(await this.asidesFor(visible, userId)));
    items.push(
      ...(await this.noticesFor(visible, userId, noticesResolvedSince)),
    );

    return items.sort((one, other) => +other.askedAt - +one.askedAt);
  }

  private assignedTo(workspaceId: string, userId: UserId) {
    const raised = alias(station, 'raised');

    return this.db
      .select({
        taskId: task.id,
        teamId: line.teamId,
        title: task.title,
        description: task.description,
        lineId: line.id,
        raisedStation: raised.name,
        raisedColor: raised.color,
        raisedPosition: raised.position,
        currentStationName: station.name,
        currentStationColor: station.color,
        currentStationPosition: station.position,
        createdAt: task.createdAt,
        working: task.currentRunId,
      })
      .from(task)
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .leftJoin(raised, eq(raised.id, task.raisedAtStationId))
      .where(
        and(
          eq(task.workspaceId, workspaceId),
          eq(task.assigneeId, userId.value),
        ),
      );
  }

  private async conversationsIn(
    rows: Awaited<ReturnType<DrizzleInboxReader['assignedTo']>>,
  ): Promise<InboxItemSummary[]> {
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
    const stationCounts = await stationsPerLine(
      this.db,
      rows.map((row) => row.lineId),
    );

    const briefings = await briefingsFor(
      this.db,
      [...trail.values()].flatMap((notes) =>
        notes.flatMap((note) => (note.runId ? [note.runId] : [])),
      ),
    );

    const items: InboxItemSummary[] = [];

    for (const row of rows) {
      const taskNotes = trail.get(row.taskId) ?? [];

      for (const conversation of conversationsOf(
        taskNotes.map((each) => each.kind),
      )) {
        const note = taskNotes[conversation.from];

        if (!note) {
          continue;
        }

        const notes = notesIn(conversation, taskNotes);
        const last = notes[notes.length - 1];

        items.push({
          kind: 'task',
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
          stationCount: stationCounts.get(row.lineId) ?? 1,
          raisedAt: {
            name: row.raisedStation ?? note.station,
            color: row.raisedColor ?? note.stationColor,
            position: row.raisedPosition ?? note.stationPosition,
          },
          currentStation: {
            name: row.currentStationName,
            color: row.currentStationColor,
            position: row.currentStationPosition,
          },
          createdAt: row.createdAt,
          askedAt: last?.at ?? note.at,
          resolved: !stillOpen(conversation),
          working:
            stillOpen(conversation) &&
            row.working !== null &&
            !awaitsAPerson(notes),
          runId: stillOpen(conversation) ? row.working : null,
          unread: anyUnread(notes),
          briefing: (note.runId && briefings.get(note.runId)) || null,
          failure: failureIn(notes),
          aside: null,
          notes,
        });
      }
    }

    return items;
  }

  private async asidesFor(
    workspaceId: string,
    userId: UserId,
  ): Promise<InboxItemSummary[]> {
    const rows = await this.db
      .select({
        id: taskAside.id,
        form: taskAside.form,
        about: taskAside.about,
        raisedAt: taskAside.raisedAt,
        readAt: taskAsideRead.readAt,
        resolvedAt: taskAside.resolvedAt,
        taskId: task.id,
        assigneeId: task.assigneeId,
        teamId: line.teamId,
        lineId: line.id,
        title: task.title,
        description: task.description,
        createdAt: task.createdAt,
        currentStationName: station.name,
        currentStationColor: station.color,
        currentStationPosition: station.position,
      })
      .from(taskAside)
      .leftJoin(
        taskAsideRead,
        and(
          eq(taskAsideRead.asideId, taskAside.id),
          eq(taskAsideRead.userId, userId.value),
        ),
      )
      .innerJoin(task, eq(task.id, taskAside.taskId))
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .where(
        and(
          eq(taskAside.workspaceId, workspaceId),
          or(
            eq(task.assigneeId, userId.value),
            isNull(task.assigneeId),
            inArray(taskAside.form, FORMS_FOR_TEAM_READERS),
          ),
        ),
      );

    const needing = (access: AsideAccess) =>
      rows.filter((row) => TaskAside.requiredAccess(row.form) === access);

    const onTeam = new Map(
      await Promise.all(
        [
          ...new Set(
            needing('seesTeam')
              .filter((row) => row.assigneeId === null)
              .map((row) => row.teamId),
          ),
        ].map(
          async (teamId) =>
            [
              teamId,
              (await this.access.onTeam(teamId, userId)) !== null,
            ] as const,
        ),
      ),
    );

    const readerOf = new Map(
      await Promise.all(
        [...new Set(needing('readsTeamOutcomes').map((row) => row.teamId))].map(
          async (teamId) =>
            [
              teamId,
              (await this.access.permissionsAsTeamReader(
                teamId,
                PersonPrincipal.of(userId),
              )) !== null,
            ] as const,
        ),
      ),
    );

    const attending = rows.filter((row) =>
      TaskAside.attendedBy({
        form: row.form,
        viewer: userId,
        assignee: row.assigneeId ? UserId.of(row.assigneeId) : null,
        seesTeam: onTeam.get(row.teamId) ?? false,
        readsTeamOutcomes: readerOf.get(row.teamId) ?? false,
      }),
    );

    if (attending.length === 0) {
      return [];
    }

    const attached = await attachmentsFor(
      this.db,
      attending.map((row) => row.taskId),
    );
    const stationCounts = await stationsPerLine(
      this.db,
      attending.map((row) => row.lineId),
    );

    return attending.map((row) => {
      const currentStation = {
        name: row.currentStationName,
        color: row.currentStationColor,
        position: row.currentStationPosition,
      };

      return {
        kind: 'task' as const,
        id: row.id,
        taskId: row.taskId,
        teamId: row.teamId,
        title: row.title,
        description: row.description,
        attachments: attachmentsOf(attached, row.taskId).own,
        station: currentStation.name,
        stationColor: currentStation.color,
        stationPosition: currentStation.position,
        stationCount: stationCounts.get(row.lineId) ?? 1,
        raisedAt: currentStation,
        currentStation,
        createdAt: row.createdAt,
        askedAt: row.raisedAt,
        resolved: row.resolvedAt !== null,
        working: false,
        runId: null,
        unread: row.readAt === null && row.resolvedAt === null,
        briefing: null,
        failure: null,
        aside: { form: row.form, about: row.about },
        notes: [],
      };
    });
  }

  private async noticesFor(
    workspaceId: string,
    userId: UserId,
    resolvedSince: Date,
  ): Promise<InboxNoticeSummary[]> {
    const rows = await this.db
      .select()
      .from(notice)
      .where(
        and(
          eq(notice.workspaceId, workspaceId),
          eq(notice.addresseeId, userId.value),
          or(isNull(notice.resolvedAt), gte(notice.resolvedAt, resolvedSince)),
        ),
      );
    const onTeam = new Map(
      await Promise.all(
        [...new Set(rows.map((row) => row.teamId))].map(
          async (teamId) =>
            [
              teamId,
              (await this.access.onTeam(teamId, userId)) !== null,
            ] as const,
        ),
      ),
    );

    return rows
      .filter((row) => onTeam.get(row.teamId))
      .map((row) => ({
        kind: 'notice',
        id: row.id,
        teamId: row.teamId,
        form: row.form,
        headline: row.headline,
        points: row.points,
        link: row.link,
        linkLabel: row.linkLabel,
        askedAt: row.raisedAt,
        unread: row.resolvedAt === null,
        resolved: row.resolvedAt !== null,
      }));
  }
}
