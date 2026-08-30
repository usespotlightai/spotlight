import { HandOver } from '@application/events/handlers/hand-over.handler';
import type { ClockPort } from '@application/ports/clock.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Run, type Said } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import { RunCompleted } from '@domain/events/run-completed.event';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-28T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const at = (id: string, name: string, position: number, harness?: HarnessId) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness,
    kind: position === 0 ? 'backlog' : 'work',
  });

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      at('station_0', 'Backlog', 0),
      at('station_1', 'Triage', 1, HarnessId.of('dev')),
      at('station_2', 'Spec', 2, HarnessId.of('dev')),
    ],
  });

// Held by a run from the start: a task cannot be handed to a second one.
const task = (held = 'run_1') =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).handedTo(RunId.of(held));

// Long enough after NOW that a lease has lapsed.
const LATER = new Date(NOW.getTime() + 120_000);

const queued = (taskId: string | null = 'task_1') =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    taskId: taskId ? TaskId.of(taskId) : null,
    spec: {},
  });

const run = (failed: boolean, said: Said = {}) => {
  const ended = queued();
  const runner = RunnerId.of('runner_1');
  ended.claim(runner, NOW);
  ended.complete(runner, { exitCode: failed ? 1 : 0, failed }, said);
  return ended;
};

// Claimed and left unreported until there are no attempts left.
const givenUp = () => {
  const ended = queued();
  const runner = RunnerId.of('runner_1');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    ended.claim(runner, NOW);
    ended.requeue(LATER);
  }
  return ended;
};

let saved: Task | undefined;

const tasks = (found: Task | null = task()) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
  }) satisfies TaskRepository;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    holding: vi.fn(async () => line()),
  }) satisfies AssemblyLineRepository;

const dispatch: TaskDispatchPort = {
  dispatch: async () => RunId.of('run_2'),
};

const handOver = (ended = run(false), held: TaskRepository = tasks()) => {
  const handler = new HandOver(held, lines(), dispatch, clock);
  const [raised] = ended.pullEvents();

  if (!raised) {
    throw new Error('the run announced nothing');
  }

  return raised instanceof RunCompleted
    ? handler.onRunCompleted(raised)
    : handler.onRunAbandoned(raised as RunAbandoned);
};

beforeEach(() => {
  saved = undefined;
});

describe('HandOver', () => {
  it('asks a person about a run that finished saying nothing', async () => {
    await handOver();

    expect(saved?.awaitingReview).toBe(true);
    expect(saved?.currentRunId).toBeNull();
    expect(saved?.notes.map((each) => each.body.value)).toEqual([
      'The run finished without saying where the task should go next.',
    ]);
  });

  it('asks a person about a run that failed, and says why', async () => {
    await handOver(run(true));

    expect(saved?.awaitingReview).toBe(true);
    expect(saved?.notes[0]?.body.value).toContain('The run failed');
  });

  it('names the station the note came from', async () => {
    await handOver();

    expect(saved?.notes[0]?.station.value).toBe('Triage');
  });

  it('leaves a task alone once another run has taken it', async () => {
    await handOver(run(false), tasks(task('run_9')));

    expect(saved).toBeUndefined();
  });

  it('leaves a run with no task of its own alone', async () => {
    const loose = queued(null);
    const runner = RunnerId.of('runner_1');
    loose.claim(runner, NOW);
    loose.complete(runner, { exitCode: 0, failed: false });

    await handOver(loose);

    expect(saved).toBeUndefined();
  });

  it('asks a person about a run nobody ever finished', async () => {
    await handOver(givenUp());

    expect(saved?.awaitingReview).toBe(true);
    expect(saved?.notes[0]?.body.value).toContain('3 attempts');
  });

  it('hands over even where the task has since gone missing', async () => {
    await expect(handOver(run(false), tasks(null))).resolves.toBeUndefined();
  });
  it('remembers the conversation the run worked in', async () => {
    await handOver(run(false, { session: HarnessSession.of('session_1') }));

    expect(saved?.sessionId?.value).toBe('session_1');
    expect(saved?.awaitingReview).toBe(true);
  });

  it('leaves the task without one when the runner reported none', async () => {
    await handOver();

    expect(saved?.sessionId).toBeNull();
  });
});
