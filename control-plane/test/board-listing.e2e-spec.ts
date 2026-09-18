import { randomUUID } from 'node:crypto';
import { TeamDirectory } from '@identity/application/services/team-directory.service';
import { WorkspaceAccess } from '@identity/application/services/workspace-access.service';
import { DrizzlePersonReader } from '@identity/infrastructure/persistence/drizzle/readers/person.reader';
import { DrizzleViewableWorkspaces } from '@identity/infrastructure/persistence/drizzle/readers/viewable-workspaces.reader';
import { DrizzleWorkspaceReader } from '@identity/infrastructure/persistence/drizzle/readers/workspace.reader';
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
import { openTeam } from './support/team';

const access = (db: DrizzleDatabase) =>
  new WorkspaceAccess(
    new DrizzleViewableWorkspaces(db),
    new DrizzleWorkspaceReader(db),
    new DrizzleWorkspaceRepository(new DrizzleContext(db), {
      dispatch: async () => {},
    }),
  );

const NOW = new Date('2026-01-02T03:04:05.000Z');

let held: TestDatabase;
let db: DrizzleDatabase;
let tasks: DrizzleTaskRepository;
let board: DrizzleTaskReader;

beforeAll(async () => {
  held = await openDatabase('board_listing');
  db = held.db;
  tasks = new DrizzleTaskRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  board = new DrizzleTaskReader(
    db,
    access(db),
    new TeamDirectory(
      new DrizzleTeamRepository(new DrizzleContext(db), {
        dispatch: async () => {},
      }),
    ),
    new DrizzlePersonReader(db),
  );
}, 60_000);

afterAll(async () => {
  await held?.close();
});

describe('the tasks the board reads for a team', () => {
  it('leaves the setup list out but keeps ordinary work', async () => {
    const { owner, teamId, stationId, line } = await openTeam(
      db,
      tasks,
      `board-${randomUUID()}`,
    );

    const work = Task.add({
      line,
      at: stationId,
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
