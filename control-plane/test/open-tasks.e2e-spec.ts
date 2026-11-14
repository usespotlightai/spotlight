import { randomUUID } from 'node:crypto';

import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { DrizzleOpenTaskReader } from '@work/infrastructure/persistence/drizzle/readers/open-task.reader';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

let database: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;
let reader: DrizzleOpenTaskReader;

beforeAll(async () => {
  database = await openDatabase('open_tasks');
  db = database.db;
  tasks = new DrizzleTaskRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  reader = new DrizzleOpenTaskReader(db);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const seedTeam = async (titles: readonly string[]) => {
  const team = await createTeam(db, tasks, `open-${randomUUID()}`);
  const added = titles.map((title, at) =>
    Task.add({
      line: team.line,
      at: team.stationId,
      title: TaskTitle.of(title),
      rank: TaskRank.between(null, null),
      createdBy: team.owner,
      now: new Date(Date.UTC(2026, 10, 14, 11, at)),
      newId: () => randomUUID(),
    }),
  );

  for (const each of added) {
    await tasks.add(each);
  }

  return {
    ...team,
    added: new Map(added.map((each) => [each.title.value, each])),
  };
};

const move = async (task: Task | undefined, stationId: string) => {
  expect(task).toBeDefined();
  await db
    .update(schema.task)
    .set({ stationId })
    .where(eq(schema.task.id, task?.id.value ?? ''));
};

const titlesOf = (found: readonly { readonly title: TaskTitle }[]) =>
  found.map((each) => each.title.value);

describe('the open tasks a run reads on its line', () => {
  it('lists the other open tasks, newest first, without the setup list', async () => {
    const { line, added } = await seedTeam(['First', 'Second', 'Third']);
    const third = added.get('Third');

    expect(third).toBeDefined();

    const found = await reader.newest(
      line.id,
      third?.id ?? TaskId.of(randomUUID()),
      10,
    );

    expect(titlesOf(found)).toEqual(['Second', 'First']);
    expect(found.map((each) => each.id)).toEqual([
      added.get('Second')?.id,
      added.get('First')?.id,
    ]);
  });

  it('leaves out a task at the completed station', async () => {
    const { line, added } = await seedTeam(['Open', 'Done']);

    await move(added.get('Done'), line.completed.id.value);

    const found = await reader.newest(line.id, TaskId.of(randomUUID()), 10);

    expect(titlesOf(found)).toEqual(['Open']);
  });

  it('leaves out a task on another line of the same team', async () => {
    const { line, added, workspaceId, teamId } = await seedTeam([
      'Here',
      'There',
    ]);
    const otherLineId = randomUUID();
    const otherStationId = randomUUID();

    await db.insert(schema.line).values({
      id: otherLineId,
      workspaceId: workspaceId.value,
      teamId: teamId.value,
      key: 'other',
      name: 'Other',
    });
    await insertStations(db, {
      id: otherStationId,
      workspaceId: workspaceId.value,
      lineId: otherLineId,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    });
    await move(added.get('There'), otherStationId);

    const found = await reader.newest(line.id, TaskId.of(randomUUID()), 10);

    expect(titlesOf(found)).toEqual(['Here']);
  });

  it('gives the last note of each task', async () => {
    const { line, stationId, added } = await seedTeam(['Noted']);
    const noted = added.get('Noted');

    expect(noted).toBeDefined();

    await db.insert(schema.taskNote).values(
      [0, 1].map((position) => ({
        taskId: noted?.id.value ?? '',
        position,
        stationId: stationId.value,
        body: `Note ${position}`,
        at: new Date('2026-11-14T12:00:00.000Z'),
        kind: 'message' as const,
      })),
    );

    const [found] = await reader.newest(line.id, TaskId.of(randomUUID()), 10);

    expect(found?.lastNote).toBe('Note 1');
  });

  it('reads no more than the limit', async () => {
    const { line } = await seedTeam(['One', 'Two', 'Three']);

    const found = await reader.newest(line.id, TaskId.of(randomUUID()), 2);

    expect(titlesOf(found)).toEqual(['Three', 'Two']);
  });
});
