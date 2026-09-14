import { randomUUID } from 'node:crypto';
import { Task } from '@domain/aggregates/task.aggregate';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import type { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { DrizzleTaskReader } from '@infrastructure/persistence/drizzle/readers/task.reader';
import { DrizzleTaskRepository } from '@infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import { openTeam } from './support/team';

const NOW = new Date('2026-01-02T03:04:05.000Z');

let held: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;
let board: DrizzleTaskReader;

beforeAll(async () => {
  held = await openDatabase('board_listing');
  db = held.db;
  tasks = new DrizzleTaskRepository({ db } as unknown as DrizzleContext);
  board = new DrizzleTaskReader(db);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

describe('the tasks the board reads for a team', () => {
  it('leaves the setup list out but keeps ordinary work', async () => {
    const { owner, workspaceId, teamId, stationId } = await openTeam(
      db,
      tasks,
      `board-${randomUUID()}`,
    );

    const work = Task.add({
      workspaceId,
      stationId,
      title: TaskTitle.of('Ship the thing'),
      rank: TaskRank.between(null, null),
      raisedBy: owner,
      now: NOW,
      newId: () => randomUUID(),
    });

    await tasks.add(work);

    const listed = await board.listForTeamMember(teamId, owner);

    expect(listed?.map((each) => each.title)).toEqual(['Ship the thing']);
  });
});
