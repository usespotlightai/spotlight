import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import {
  decodeCursor,
  type PageRequest,
} from '@shared-kernel/application/dto/page.dto';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxItemSummary } from '@work/application/ports/inbox-reader.port';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleRunReader } from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

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
  before: next ? decodeCursor(next) : null,
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
  await db.insert(schema.station).values([
    {
      id: work,
      key: 'implementation',
      lineId,
      name: 'Implementation',
      position: 0,
    },
    {
      id: completed,
      key: 'completed',
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

  const addNotes = (
    taskId: string,
    kinds: readonly {
      kind: 'asked' | 'answered' | 'passed' | 'reopened';
      at: Date;
      unseen?: boolean;
    }[],
  ) =>
    db.insert(schema.taskNote).values(
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
        readAt: each.unseen ? null : each.at,
      })),
    );

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

const inboxOf = (workspaceId: string) =>
  new DrizzleInboxReader(
    db,
    { mayView: async () => true, onTeam: async () => null } as never,
    { idForSlug: async () => workspaceId } as never,
    { findMany: async () => new Map() } as never,
  );

const boardOf = (workspaceId: string) =>
  new DrizzleTaskReader(
    db,
    { mayView: async () => true } as never,
    {
      find: async () => ({ workspaceId: WorkspaceId.of(workspaceId) }),
    } as never,
    { findMany: async () => new Map() } as never,
  );

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
    expect(open[0]).toMatchObject({ resolved: true, unread: true });
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
