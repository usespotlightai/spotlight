import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';
import { conversationsOf, notesIn } from '@work/domain/services/conversations';
import { anyUnread } from '@work/domain/services/unread';
import {
  closesAConversation,
  hasAnUnseenAsk,
} from '@work/infrastructure/persistence/drizzle/readers/conversation-filters';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

const KINDS = [
  'asked',
  'answered',
  'passed',
  'reopened',
] as const satisfies readonly TaskNoteKind[];

const LONGEST = 6;

const AT = new Date(Date.UTC(2026, 10, 6, 9, 0, 0));

const sequencesUpTo = (length: number): TaskNoteKind[][] => {
  const all: TaskNoteKind[][] = [];
  let previous: TaskNoteKind[][] = [[]];

  for (let size = 1; size <= length; size++) {
    previous = previous.flatMap((sequence) =>
      KINDS.map((kind) => [...sequence, kind]),
    );
    all.push(...previous);
  }

  return all;
};

interface Trail {
  readonly taskId: string;
  readonly notes: readonly { kind: TaskNoteKind; readAt: Date | null }[];
}

let database: TestDatabase;
let db: DrizzleDatabase;
let workspaceId: string;
let trails: Trail[];

beforeAll(async () => {
  database = await openDatabase('conversation_filters');
  db = database.db;
  workspaceId = randomUUID();

  const lineId = randomUUID();
  const stationId = randomUUID();

  await db.insert(schema.line).values({
    id: lineId,
    key: `delivery-${lineId}`,
    workspaceId,
    teamId: `team_${randomUUID()}`,
    name: 'Delivery',
  });
  await db.insert(schema.station).values({
    id: stationId,
    key: 'implementation',
    lineId,
    name: 'Implementation',
    position: 0,
  });

  trails = sequencesUpTo(LONGEST).map((kinds, index) => ({
    taskId: randomUUID(),
    notes: kinds.map((kind, position) => ({
      kind,
      readAt: (index + position) % 2 === 0 ? null : AT,
    })),
  }));

  const tasks = trails.map((trail) => ({
    id: trail.taskId,
    branch: `feat/test-${trail.taskId}`,
  }));
  const notes = trails.flatMap((trail) =>
    trail.notes.map((note, position) => ({
      task_id: trail.taskId,
      position,
      kind: note.kind,
      read_at: note.readAt?.toISOString() ?? null,
    })),
  );

  await db.execute(sql`insert into task
      (id, branch, opened_from, workspace_id, station_id, title)
    select each.id, each.branch, 'person', ${workspaceId}, ${stationId}, each.id
    from jsonb_to_recordset(${JSON.stringify(tasks)}::jsonb)
      as each(id text, branch text)`);
  await db.execute(sql`insert into task_note
      (task_id, position, station, station_id, body, at, kind, read_at)
    select each.task_id, each.position, 'Implementation', ${stationId},
      each.kind, ${AT.toISOString()}::timestamp, each.kind, each.read_at
    from jsonb_to_recordset(${JSON.stringify(notes)}::jsonb)
      as each(task_id text, position integer, kind text, read_at timestamp)`);
}, 120_000);

afterAll(async () => {
  await database?.close();
});

const key = (taskId: string, position: number) => `${taskId}#${position}`;

describe('the read-model filters on conversations', () => {
  it('selects the notes that close a conversation, apart from passes after a reopening that reopened nothing', async () => {
    const selected = await db
      .select({
        taskId: schema.taskNote.taskId,
        position: schema.taskNote.position,
      })
      .from(schema.taskNote)
      .innerJoin(schema.task, eq(schema.task.id, schema.taskNote.taskId))
      .where(
        and(eq(schema.task.workspaceId, workspaceId), closesAConversation),
      );
    const bySql = new Set(
      selected.map((each) => key(each.taskId, each.position)),
    );
    const byDomain = new Set(
      trails.flatMap((trail) =>
        conversationsOf(trail.notes.map((each) => each.kind)).flatMap(
          (conversation) =>
            conversation.to === null
              ? []
              : [key(trail.taskId, conversation.to)],
        ),
      ),
    );
    const askedBefore = new Map(
      trails.flatMap((trail) =>
        trail.notes.map(
          (_, position) =>
            [
              key(trail.taskId, position),
              trail.notes
                .slice(0, position)
                .some((each) => each.kind === 'asked'),
            ] as const,
        ),
      ),
    );
    const missed = [...byDomain].filter((each) => !bySql.has(each));
    const extra = [...bySql].filter((each) => !byDomain.has(each));

    expect(byDomain.size).toBeGreaterThan(0);
    expect(missed).toEqual([]);
    expect(extra.filter((each) => askedBefore.get(each) !== false)).toEqual([]);
  });

  it('selects the tasks with an unread ask in one of their conversations', async () => {
    const selected = await db
      .select({ id: schema.task.id })
      .from(schema.task)
      .where(and(eq(schema.task.workspaceId, workspaceId), hasAnUnseenAsk));
    const bySql = new Set(selected.map((each) => each.id));
    const byDomain = new Set(
      trails
        .filter((trail) =>
          conversationsOf(trail.notes.map((each) => each.kind)).some(
            (conversation) => anyUnread(notesIn(conversation, trail.notes)),
          ),
        )
        .map((trail) => trail.taskId),
    );

    expect(byDomain.size).toBeGreaterThan(0);
    expect(byDomain.size).toBeLessThan(trails.length);
    expect([...bySql].sort()).toEqual([...byDomain].sort());
  });
});
