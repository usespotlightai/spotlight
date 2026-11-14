import { randomUUID } from 'node:crypto';

import { DrizzlePersonReader } from '@identity/infrastructure/persistence/drizzle/readers/person.reader';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { TeamNotKnownYetError } from '@work/application/errors/team-not-known-yet.error';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { silentLogger } from './support/logger';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const NOW = new Date('2026-01-02T03:04:05.000Z');

let database: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;
let reader: DrizzleTaskReader;

const logged = { ...silentLogger, error: vi.fn() } satisfies LoggerPort;

type Team = Awaited<ReturnType<typeof createTeam>>;

const opened = (team: Team) =>
  Task.add({
    line: team.line,
    at: team.stationId,
    title: TaskTitle.of('Ship the thing'),
    rank: TaskRank.between(null, null),
    createdBy: team.owner,
    now: NOW,
    newId: () => randomUUID(),
  });

const identifiersOf = async (team: Team) =>
  (await reader.listForTeam(team.teamId, { state: 'board' })).items
    .map((each) => each.identifier)
    .sort();

beforeAll(async () => {
  database = await openDatabase('task_identifiers');
  db = database.db;
  tasks = new DrizzleTaskRepository(
    new DrizzleContext(db),
    { dispatch: async () => {} },
    logged,
  );
  reader = new DrizzleTaskReader(db, new DrizzlePersonReader(db), {
    progressOf: async () => [],
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('the identifier of a task', () => {
  it('counts the tasks of a team from one, after its upper-case key', async () => {
    const team = await createTeam(db, tasks, `spo-${randomUUID()}`);

    await tasks.add(opened(team));
    await tasks.add(opened(team));

    const key = team.slug.toUpperCase();

    expect(await identifiersOf(team)).toEqual([`${key}-2`, `${key}-3`]);
  });

  it('starts a second team at one', async () => {
    const first = await createTeam(db, tasks, `first-${randomUUID()}`);
    const second = await createTeam(db, tasks, `second-${randomUUID()}`);

    await tasks.add(opened(first));

    const numbers = await db
      .select({ number: schema.task.number })
      .from(schema.task)
      .where(eq(schema.task.teamId, second.teamId.value));

    expect(numbers).toEqual([{ number: 1 }]);
  });

  it('gives no number twice when tasks open at the same time', async () => {
    const team = await createTeam(db, tasks, `race-${randomUUID()}`);

    await Promise.all(Array.from({ length: 8 }, () => tasks.add(opened(team))));

    const numbers = (
      await db
        .select({ number: schema.task.number })
        .from(schema.task)
        .where(eq(schema.task.teamId, team.teamId.value))
    )
      .map((each) => each.number)
      .sort((a, b) => a - b);

    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('leaves no gap when the task fails to open', async () => {
    const team = await createTeam(db, tasks, `gap-${randomUUID()}`);
    const added = opened(team);

    await tasks.add(added);
    await expect(tasks.add(added)).rejects.toThrow('Failed query');
    await tasks.add(opened(team));

    expect(await identifiersOf(team)).toEqual([
      `${team.slug.toUpperCase()}-2`,
      `${team.slug.toUpperCase()}-3`,
    ]);
  });

  it('fails and logs the team where Work has no key for it yet', async () => {
    const team = await createTeam(db, tasks, `lost-${randomUUID()}`);

    await db
      .delete(schema.workTeam)
      .where(eq(schema.workTeam.teamId, team.teamId.value));

    await expect(tasks.add(opened(team))).rejects.toThrow(TeamNotKnownYetError);
    expect(logged.error).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: team.teamId.value }),
      expect.any(String),
    );
  });
});
