import { randomUUID } from 'node:crypto';
import { Line } from '@lines/domain/aggregates/line.aggregate';
import { BUILT_IN_LINES } from '@lines/domain/services/built-in-lines';
import { DrizzleLineRepository } from '@lines/infrastructure/persistence/drizzle/repositories/line.repository';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import {
  HAPPENING_REACTIONS,
  type HappeningReactionsPort,
} from '@work/application/ports/happening-reactions.port';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp } from './support/app';
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import { mapOf, projectStations } from './support/stations';
import { createTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
let line: LineMap;
let tasks: DrizzleTaskRepository;
let runs: DrizzleRunRepository;

const stationKeyed = (key: string) => {
  const station = line.stationKeyed(StationKey.of(key));

  if (!station) {
    throw new Error(`the Delivery line has no ${key} station`);
  }

  return station;
};

const found = async (id: TaskId): Promise<Task> => {
  const task = await tasks.find(id);

  if (!task) {
    throw new Error(`task ${id.value} is gone`);
  }

  return task;
};

const finishedAt = async (station: string, thread: string): Promise<Task> => {
  const added = Task.add({
    line,
    at: stationKeyed(station).id,
    title: TaskTitle.of('Add a theme selector'),
    rank: TaskRank.of('i'),
    now: new Date(),
    newId: () => randomUUID(),
  }).markedBy(Mark.of('slack.thread', thread), new Date(0));
  const finished = Task.rehydrate({ ...added, finishedAt: new Date() });

  await tasks.add(finished);

  return finished;
};

const mentioned = (thread: string, email: string) => {
  const happened: Happened = {
    happening: 'slack.app_mention',
    summary: 'Somebody mentioned Spotlight in Slack.',
    answers: false,
    state: 'raised',
    correlationKeys: {
      branch: null,
      marks: [{ kind: 'slack.thread', value: thread }],
    },
    message: { body: 'Match the theme switch to this design.' },
    ourOwn: false,
    opens: null,
    chat: {
      email,
      harness: null,
      marks: [{ kind: 'slack.thread', value: thread, finds: true }],
    },
  };

  return app
    .get<HappeningReactionsPort>(HAPPENING_REACTIONS)
    .react(team.workspaceId, team.teamId, [happened], randomUUID());
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  tasks = app.get(DrizzleTaskRepository);
  runs = app.get(DrizzleRunRepository);
  team = await createTeam(db, tasks, `mention-${randomUUID().slice(0, 8)}`);

  const opening = BUILT_IN_LINES.find((each) =>
    each.role?.equals(LineRole.DELIVERY),
  );

  if (!opening) {
    throw new Error('Spotlight ships no delivery line');
  }

  const created = Line.create({
    by: changeActorIn(),
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    line: opening,
    harness: HarnessId.of('claude-code'),
    newId: () => randomUUID(),
  });
  await app.get(DrizzleLineRepository).add(created);
  await projectStations(
    db,
    created.stations.map((each) => each.id.value),
  );
  line = mapOf(created);
}, 60_000);

afterAll(async () => {
  await deleteRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a mention in the thread of a finished task (e2e)', () => {
  it('reopens the task where it finished, with the words, and queues a run', async () => {
    const thread = `C1:${randomUUID()}`;
    const task = await finishedAt('code-review', thread);

    await mentioned(thread, `${team.owner.value}@example.com`);

    const after = await found(task.id);
    const last = after.notes[after.notes.length - 1];

    expect(after.finished).toBe(false);
    expect(after.stationId).toEqual(stationKeyed('code-review').id);
    expect(last?.body.value).toContain('Match the theme switch');
    expect(last?.voice.author).toEqual(team.owner);
    const runId = after.currentRunId;
    expect(runId).not.toBeNull();
    expect(runId && (await eventually(() => runs.findById(runId)))?.state).toBe(
      'queued',
    );
  });

  it('leaves a task at the completed station alone', async () => {
    const thread = `C1:${randomUUID()}`;
    const task = await finishedAt('completed', thread);

    await mentioned(thread, `${team.owner.value}@example.com`);

    const after = await found(task.id);
    expect(after.finished).toBe(true);
    expect(after.notes).toHaveLength(task.notes.length);
    expect(after.currentRunId).toBeNull();
  });

  it('leaves the task alone when nobody in the workspace has the email', async () => {
    const thread = `C1:${randomUUID()}`;
    const task = await finishedAt('code-review', thread);

    await mentioned(thread, 'stranger@example.com');

    const after = await found(task.id);
    expect(after.finished).toBe(true);
    expect(after.currentRunId).toBeNull();
  });
});
