import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  InboxEntrySummary,
  InboxScope,
} from '@work/application/ports/inbox-reader.port';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

const NOW = new Date('2026-11-20T09:00:00.000Z');
const LINEAR = IntegrationName.of('linear');

let database: TestDatabase;
let tasks: DrizzleTaskRepository;
let reader: DrizzleInboxReader;
let line: LineMap;
let teamId: string;
let workspaceId: string;
let holder: UserId;
const asked = UserId.of(`user_${randomUUID()}`);
const bystander = UserId.of(`user_${randomUUID()}`);

beforeAll(async () => {
  database = await openDatabase('held_task_asks');
  const context = new DrizzleContext(database.db);

  tasks = new DrizzleTaskRepository(context, { dispatch: async () => {} });
  reader = new DrizzleInboxReader(
    database.db,
    { findMany: async () => new Map() } as never,
    new RunReadModel(new DrizzleRunFactsReader(context)),
  );

  const team = await createTeam(
    database.db,
    tasks,
    `held-${randomUUID().slice(0, 8)}`,
  );
  holder = team.owner;
  teamId = team.teamId.value;
  workspaceId = team.workspaceId.value;
  line = deliveryLineOf({
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    harness: HarnessId.of('dev'),
    newId: () => randomUUID(),
  });

  await database.db.insert(schema.line).values({
    id: line.id.value,
    workspaceId,
    teamId,
    key: line.key.value,
    name: line.name.value,
  });
  await insertStations(
    database.db,
    line.stations.map((each) => ({
      id: each.id.value,
      workspaceId,
      lineId: line.id.value,
      key: each.key.value,
      name: each.name.value,
      position: each.position,
      kind: each.kind,
    })),
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const scopeOf = (viewer: UserId): InboxScope => ({
  workspaceId,
  viewer,
  teamsSeen: new Set([teamId]),
  teamsActedOn: new Set(),
  teamsJoined: new Set([teamId]),
});

const heldAndAsking = async (): Promise<Task> => {
  const implementation = line.stationKeyed(StationKey.of('implementation'));

  if (!implementation) {
    throw new Error('the delivery line has no implementation station');
  }

  const turn = RunId.of(randomUUID());
  const task = Task.add({
    line,
    at: implementation.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    createdBy: holder,
    now: NOW,
    newId: () => randomUUID(),
  })
    .assignRun(RunId.of(randomUUID()), line)
    .hold({
      id: HoldId.of(randomUUID()),
      by: holder,
      members: TeamMembers.of([holder, asked]),
      line,
      currentRunStarted: true,
      at: NOW,
    })
    .addMessage({
      line,
      body: TaskNoteBody.of('Use a bounded queue.'),
      at: NOW,
      voice: Voice.person(holder),
    })
    .assignRun(turn, line)
    .askToConnect(
      turn,
      {
        line,
        body: TaskNoteBody.of('Connect Linear.'),
        at: NOW,
        voice: Voice.station(turn),
      },
      ConnectionAsk.of({
        teamId: line.teamId,
        integration: LINEAR,
        providedBy: 'Linear',
        personId: asked,
      }),
    ).task;

  await tasks.add(task);

  return task;
};

const standingIn = (
  entries: readonly InboxEntrySummary[],
  task: Task,
): string | null | undefined => {
  const entry = entries.find(
    (each) => each.kind === 'task' && each.taskId === task.id.value,
  );

  return entry && 'standing' in entry ? entry.standing : undefined;
};

describe('a held task whose turn asks another person (e2e)', () => {
  it('lists the ask for the person it names, and keeps the task with its holder', async () => {
    const task = await heldAndAsking();

    expect(standingIn(await reader.open(scopeOf(asked)), task)).toBe('asked');
    expect(standingIn(await reader.open(scopeOf(holder)), task)).toBe(
      'assignee',
    );
  });

  it('lists nothing for a team member the ask does not name', async () => {
    const task = await heldAndAsking();

    expect(
      standingIn(await reader.open(scopeOf(bystander)), task),
    ).toBeUndefined();
  });

  it('stops listing the ask once the person connects', async () => {
    const task = await heldAndAsking();
    const connected = task.connectionMade(line.teamId, LINEAR, asked, {
      line,
      at: NOW,
    });

    if (!connected) {
      throw new Error('the connection did not answer the ask');
    }

    await tasks.save(connected);

    expect(standingIn(await reader.open(scopeOf(asked)), task)).not.toBe(
      'asked',
    );
  });
});
