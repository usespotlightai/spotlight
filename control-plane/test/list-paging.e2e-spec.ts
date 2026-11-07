import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { PageRequest } from '@work/application/dto/page.dto';
import { InvalidPageCursorError } from '@work/application/errors/invalid-page-cursor.error';
import type { InboxItemSummary } from '@work/application/ports/inbox-reader.port';
import { conversationsOf } from '@work/domain/services/conversations';
import { anyUnread } from '@work/domain/services/unread';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleRunReader } from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { insertStations } from './support/stations';

let database: TestDatabase;
let db: DrizzleDatabase;

beforeAll(async () => {
  database = await openDatabase('list_paging');
  db = database.db;
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const at = (minute: number) => new Date(Date.UTC(2026, 9, 20, 9, minute, 0, 0));

const pageAfter = (next: string | null, limit: number): PageRequest => ({
  before: next,
  limit,
});

const aLine = async () => {
  const workspaceId = randomUUID();
  const teamId = `team_${randomUUID()}`;
  const lineId = randomUUID();
  const work = randomUUID();
  const completed = randomUUID();
  const viewer = `user_${randomUUID()}`;

  await db.insert(schema.line).values({
    id: lineId,
    key: `delivery-${lineId}`,
    workspaceId,
    teamId,
    name: 'Delivery',
  });
  await insertStations(db, [
    {
      id: work,
      key: 'implementation',
      workspaceId,
      lineId,
      name: 'Implementation',
      position: 0,
    },
    {
      id: completed,
      key: 'completed',
      workspaceId,
      lineId,
      name: 'Completed',
      position: 1,
      kind: 'completed',
    },
  ]);

  const addTask = async (input: {
    stationId: string;
    rank?: string;
    finishedAt?: Date | null;
  }) => {
    const taskId = randomUUID();

    await db.insert(schema.task).values({
      id: taskId,
      branch: `feat/test-${taskId}`,
      openedFrom: 'person',
      workspaceId,
      stationId: input.stationId,
      title: `Task ${taskId}`,
      rank: input.rank ?? 'i',
      assigneeId: viewer,
      finishedAt: input.finishedAt ?? null,
    });

    return taskId;
  };

  const addNotes = async (
    taskId: string,
    kinds: readonly {
      kind: 'asked' | 'answered' | 'passed' | 'reopened';
      at: Date;
      unseen?: boolean;
      form?: 'words' | 'resolved';
    }[],
  ) => {
    const closing = new Set(
      conversationsOf(kinds.map((each) => each.kind)).flatMap((each) =>
        each.to === null ? [] : [each.to],
      ),
    );

    await db
      .update(schema.task)
      .set({
        unreadAsk: anyUnread(
          kinds.map((each) => ({
            kind: each.kind,
            readAt: each.unseen ? null : each.at,
          })),
        ),
      })
      .where(eq(schema.task.id, taskId));
    await db.insert(schema.taskNote).values(
      kinds.map((each, position) => ({
        taskId,
        position,
        station: 'Implementation',
        stationId: work,
        body: `${each.kind} ${position}`,
        at: each.at,
        voice:
          each.kind === 'asked' ? ('station' as const) : ('person' as const),
        kind: each.kind,
        form: each.form ?? ('words' as const),
        readAt: each.unseen ? null : each.at,
        closesConversation: closing.has(position),
      })),
    );
  };

  return {
    workspaceId,
    teamId,
    work,
    completed,
    viewer,
    addTask,
    addNotes,
  };
};

const inboxOf = (workspaceId: string) => {
  const reader = new DrizzleInboxReader(db, {
    findMany: async () => new Map(),
  } as never);
  const scope = (viewer: UserId) => ({
    workspaceId,
    viewer,
    teamsSeen: new Set<string>(),
    teamsRead: new Set<string>(),
  });

  return {
    openForWorkspaceMember: (_slug: string, viewer: UserId) =>
      reader.open(scope(viewer)),
    resolvedForWorkspaceMember: (
      _slug: string,
      viewer: UserId,
      page: PageRequest,
    ) => reader.resolved(scope(viewer), page),
    itemForWorkspaceMember: (_slug: string, viewer: UserId, itemId: string) =>
      reader.item(scope(viewer), itemId),
  };
};

const boardOf = (_workspaceId: string) => {
  const reader = new DrizzleTaskReader(db, {
    findMany: async () => new Map(),
  } as never);

  return {
    listForTeamMember: (
      team: TeamId,
      _viewer: UserId,
      listing: Parameters<DrizzleTaskReader['listForTeam']>[1],
    ) => reader.listForTeam(team, listing),
  };
};

describe('the inbox, open and resolved', () => {
  it('lists open conversations with their newest note, and pages the resolved ones', async () => {
    const line = await aLine();
    const first = await line.addTask({ stationId: line.work });
    const second = await line.addTask({ stationId: line.work });

    await line.addNotes(first, [
      { kind: 'asked', at: at(0) },
      { kind: 'passed', at: at(1) },
      { kind: 'asked', at: at(5) },
      { kind: 'answered', at: at(6) },
    ]);
    await line.addNotes(second, [
      { kind: 'asked', at: at(2) },
      { kind: 'passed', at: at(3) },
    ]);

    const inbox = inboxOf(line.workspaceId);
    const viewer = UserId.of(line.viewer);

    const open = (await inbox.openForWorkspaceMember('acme', viewer)) ?? [];

    expect(open.map((each) => each.id)).toEqual([`${first}:2`]);
    expect((open[0] as InboxItemSummary | undefined)?.lastNote?.body).toBe(
      'answered 3',
    );

    const one = await inbox.resolvedForWorkspaceMember(
      'acme',
      viewer,
      pageAfter(null, 1),
    );
    const two = await inbox.resolvedForWorkspaceMember(
      'acme',
      viewer,
      pageAfter(one?.next ?? null, 1),
    );
    const three = await inbox.resolvedForWorkspaceMember(
      'acme',
      viewer,
      pageAfter(two?.next ?? null, 1),
    );

    expect(one?.items.map((each) => each.id)).toEqual([`${second}:0`]);
    expect(two?.items.map((each) => each.id)).toEqual([`${first}:0`]);
    expect(
      (two?.items[0] as InboxItemSummary | undefined)?.lastNote?.body,
    ).toBe('passed 1');
    expect(three).toEqual({ items: [], next: null });
  });

  it('keeps a resolved conversation open while its ask is unseen, on a finished task too', async () => {
    const line = await aLine();
    const finished = await line.addTask({
      stationId: line.completed,
      finishedAt: at(9),
    });
    const seen = await line.addTask({ stationId: line.work });

    await line.addNotes(finished, [
      { kind: 'asked', at: at(0), unseen: true },
      { kind: 'answered', at: at(1) },
      { kind: 'passed', at: at(2) },
    ]);
    await line.addNotes(seen, [
      { kind: 'asked', at: at(3) },
      { kind: 'passed', at: at(4) },
    ]);

    const open =
      (await inboxOf(line.workspaceId).openForWorkspaceMember(
        'acme',
        UserId.of(line.viewer),
      )) ?? [];

    expect(open.map((each) => each.id)).toEqual([`${finished}:0`]);
    expect(open[0]).toMatchObject({
      resolved: true,
      unread: true,
      section: 'open',
    });
    expect((open[0] as InboxItemSummary | undefined)?.lastNote?.body).toBe(
      'passed 2',
    );
  });

  it('reads past station passes that close no conversation, and counts only the last close of a reopened one', async () => {
    const line = await aLine();
    const asked = await line.addTask({ stationId: line.work });
    const passedOn = await line.addTask({ stationId: line.work });

    await line.addNotes(asked, [
      { kind: 'asked', at: at(0) },
      { kind: 'passed', at: at(1) },
      { kind: 'reopened', at: at(2) },
      { kind: 'passed', at: at(3) },
    ]);
    await line.addNotes(
      passedOn,
      Array.from({ length: 15 }, (_, minute) => ({
        kind: 'passed' as const,
        at: at(10 + minute),
      })),
    );

    const resolved = await inboxOf(line.workspaceId).resolvedForWorkspaceMember(
      'acme',
      UserId.of(line.viewer),
      pageAfter(null, 1),
    );

    expect(resolved?.items.map((each) => each.id)).toEqual([`${asked}:0`]);
    expect(
      (resolved?.items[0] as InboxItemSummary | undefined)?.lastNote?.body,
    ).toBe('passed 3');
    expect(resolved?.next).toBeNull();
  });

  it('lets a person reopen only the last conversation, where a person resolved it', async () => {
    const line = await aLine();
    const resolved = await line.addTask({ stationId: line.work });
    const followed = await line.addTask({ stationId: line.work });

    await line.addNotes(resolved, [
      { kind: 'asked', at: at(0) },
      { kind: 'passed', at: at(1), form: 'resolved' },
    ]);
    await line.addNotes(followed, [
      { kind: 'asked', at: at(2) },
      { kind: 'passed', at: at(3), form: 'resolved' },
      { kind: 'asked', at: at(4) },
    ]);

    const page = await inboxOf(line.workspaceId).resolvedForWorkspaceMember(
      'acme',
      UserId.of(line.viewer),
      pageAfter(null, 10),
    );

    expect(
      page?.items.map((each) => ({
        id: each.id,
        section: each.section,
        reopenable: each.reopenable,
      })),
    ).toEqual([
      { id: `${followed}:0`, section: 'resolved', reopenable: false },
      { id: `${resolved}:0`, section: 'resolved', reopenable: true },
    ]);
  });

  it('refuses a cursor it did not give', async () => {
    const line = await aLine();
    const rankCursor = Buffer.from(JSON.stringify(['a0', 'task_1'])).toString(
      'base64url',
    );

    for (const before of ['not-a-cursor', rankCursor]) {
      await expect(
        inboxOf(line.workspaceId).resolvedForWorkspaceMember(
          'acme',
          UserId.of(line.viewer),
          pageAfter(before, 1),
        ),
      ).rejects.toThrow(InvalidPageCursorError);
    }
  });

  it('opens a resolved conversation by its id, with every note', async () => {
    const line = await aLine();
    const taskId = await line.addTask({ stationId: line.work });

    await line.addNotes(taskId, [
      { kind: 'asked', at: at(0) },
      { kind: 'answered', at: at(1) },
      { kind: 'passed', at: at(2) },
    ]);

    const found = await inboxOf(line.workspaceId).itemForWorkspaceMember(
      'acme',
      UserId.of(line.viewer),
      `${taskId}:0`,
    );

    expect(found?.resolved).toBe(true);
    expect(found?.notes.map((each) => each.body)).toEqual([
      'asked 0',
      'answered 1',
      'passed 2',
    ]);
  });

  it('opens a conversation only for the person the task is assigned to, as the lists do', async () => {
    const line = await aLine();
    const taskId = await line.addTask({ stationId: line.work });

    await line.addNotes(taskId, [{ kind: 'asked', at: at(0) }]);

    expect(
      await inboxOf(line.workspaceId).itemForWorkspaceMember(
        'acme',
        UserId.of(`someone-else-${randomUUID()}`),
        `${taskId}:0`,
      ),
    ).toBeNull();
  });
});

describe('the board, open and completed', () => {
  it('lists the open tasks and pages the completed ones in board order', async () => {
    const line = await aLine();
    const working = await line.addTask({ stationId: line.work });
    const done = [
      await line.addTask({ stationId: line.completed, rank: 'a' }),
      await line.addTask({ stationId: line.completed, rank: 'b' }),
      await line.addTask({ stationId: line.completed, rank: 'c' }),
    ];
    await line.addNotes(working, [
      { kind: 'asked', at: at(0) },
      { kind: 'answered', at: at(1) },
    ]);

    const board = boardOf(line.workspaceId);
    const team = TeamId.of(line.teamId);
    const viewer = UserId.of(line.viewer);

    const open = await board.listForTeamMember(team, viewer, {
      state: 'open',
    });
    const first = await board.listForTeamMember(team, viewer, {
      state: 'completed',
      lineId: null,
      page: pageAfter(null, 2),
    });
    const second = await board.listForTeamMember(team, viewer, {
      state: 'completed',
      lineId: null,
      page: pageAfter(first?.next ?? null, 2),
    });

    expect(open?.items.map((each) => each.id)).toEqual([working]);
    expect(open?.items[0]?.note?.body).toBe('answered 1');
    expect(first?.items.map((each) => each.id)).toEqual(done.slice(0, 2));
    expect(second?.items.map((each) => each.id)).toEqual(done.slice(2));
    expect(second?.next).toBeNull();
  });
});

describe('the runs of a team', () => {
  it('pages the runs newest first and reads one by id', async () => {
    const line = await aLine();
    const taskId = await line.addTask({ stationId: line.work });
    const runIds = [randomUUID(), randomUUID(), randomUUID()];

    await db.insert(schema.run).values(
      runIds.map((id, minute) => ({
        id,
        workspaceId: line.workspaceId,
        harness: 'dev',
        taskId,
        stationId: line.work,
        state: 'completed' as const,
        spec: {},
        createdAt: at(minute),
        endedAt: at(minute),
      })),
    );

    const runs = new DrizzleRunReader(
      db,
      { viewableBy: async () => new Set([line.workspaceId]) } as never,
      { findMany: async () => new Map() } as never,
    );
    const team = TeamId.of(line.teamId);
    const viewer = UserId.of(line.viewer);

    const first = await runs.listForTeam(team, viewer, pageAfter(null, 2));
    const second = await runs.listForTeam(
      team,
      viewer,
      pageAfter(first.next, 2),
    );
    const one = await runs.findForTeam(
      team,
      RunId.of(runIds[0] as string),
      viewer,
    );

    expect(first.items.map((each) => each.id)).toEqual([runIds[2], runIds[1]]);
    expect(second.items.map((each) => each.id)).toEqual([runIds[0]]);
    expect(second.next).toBeNull();
    expect(one?.id).toBe(runIds[0]);
  });
});
