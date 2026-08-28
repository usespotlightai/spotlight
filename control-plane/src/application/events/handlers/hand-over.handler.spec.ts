import { HandOver } from '@application/events/handlers/hand-over.handler';
import type { ClockPort } from '@application/ports/clock.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { RunnerPool } from '@domain/value-objects/runner-pool.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-28T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const at = (id: string, name: string, position: number, pool?: RunnerPool) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    pool,
  });

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      at('station_1', 'Triage', 0, RunnerPool.of('dev')),
      at('station_2', 'Spec', 1, RunnerPool.of('dev')),
    ],
  });

const task = () =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: () => 'task_1',
  }).handedTo(RunId.of('run_1'));

const run = (failed: boolean) => {
  const queued = Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    pool: 'dev',
    taskId: TaskId.of('task_1'),
    spec: {},
  });
  const runner = RunnerId.of('runner_1');
  queued.claim(runner, NOW);
  queued.complete(runner, { exitCode: failed ? 1 : 0, failed });
  return queued;
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

const handOver = (finished = run(false), held: TaskRepository = tasks()) =>
  new HandOver(held, lines(), dispatch, clock).handOver(finished);

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
    await handOver(run(false), tasks(task().handedTo(RunId.of('run_9'))));

    expect(saved).toBeUndefined();
  });

  it('leaves a run with no task of its own alone', async () => {
    const loose = Run.enqueue({
      id: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      pool: 'dev',
      spec: {},
    });

    await handOver(loose);

    expect(saved).toBeUndefined();
  });

  it('hands over even where the task has since gone missing', async () => {
    await expect(handOver(run(false), tasks(null))).resolves.toBeUndefined();
  });
});
