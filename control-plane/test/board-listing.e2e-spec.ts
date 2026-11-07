import { randomUUID } from 'node:crypto';
import { WorkspaceAccess } from '@identity/application/services/workspace-access.service';
import { DrizzlePersonReader } from '@identity/infrastructure/persistence/drizzle/readers/person.reader';
import { DrizzleWorkspaceRoles } from '@identity/infrastructure/persistence/drizzle/readers/workspace-roles.reader';
import { DrizzleTeamRepository } from '@identity/infrastructure/persistence/drizzle/repositories/team.repository';
import { DrizzleWorkspaceRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace.repository';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import { createTeam } from './support/team';

const _access = (db: DrizzleDatabase) =>
  new WorkspaceAccess(
    new DrizzleWorkspaceRoles(db),
    new DrizzleWorkspaceRepository(new DrizzleContext(db), {
      dispatch: async () => {},
    }),
    new DrizzleTeamRepository(new DrizzleContext(db), {
      dispatch: async () => {},
    }),
  );

const NOW = new Date('2026-01-02T03:04:05.000Z');

let database: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;
let board: DrizzleTaskReader;

beforeAll(async () => {
  database = await openDatabase('board_listing');
  db = database.db;
  tasks = new DrizzleTaskRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  board = new DrizzleTaskReader(db, new DrizzlePersonReader(db), {
    progressOf: async () => [],
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('the tasks the board reads for a team', () => {
  it('leaves the setup list out but keeps ordinary work', async () => {
    const { owner, teamId, stationId, line } = await createTeam(
      db,
      tasks,
      `board-${randomUUID()}`,
    );

    const work = Task.add({
      line,
      at: stationId,
      title: TaskTitle.of('Ship the thing'),
      rank: TaskRank.between(null, null),
      createdBy: owner,
      now: NOW,
      newId: () => randomUUID(),
    });

    await tasks.add(work);

    const listed = await board.listForTeam(teamId, { state: 'board' });

    expect(listed?.items.map((each) => each.title)).toEqual(['Ship the thing']);
  });
});
