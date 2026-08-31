import { CompleteMergedTaskCommand } from '@application/commands/complete-merged-task.command';
import { CompleteMergedTaskHandler } from '@application/commands/handlers/complete-merged-task.handler';
import type { ClockPort } from '@application/ports/clock.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const transaction: TransactionPort = { run: async (work) => work() };
const MERGED = 'https://github.com/acme/api/pull/7';

const at = (id: string, name: string, position: number, harness?: HarnessId) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness,
    kind:
      position === 0 ? 'backlog' : name === 'Completed' ? 'completed' : 'work',
  });

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      at('station_0', 'Backlog', 0),
      at('station_1', 'Code Review', 1, HarnessId.of('dev')),
      at('station_2', 'Completed', 2),
    ],
  });

const opened = (stationId = 'station_1') =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).openedAt(PullRequestUrl.of(MERGED));

let saved: Task | undefined;

const tasks = (found: Task | null) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    withPullRequest: vi.fn(async () => found),
  }) satisfies TaskRepository;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    holding: vi.fn(async () => line()),
  }) satisfies AssemblyLineRepository;

const merged = (found: Task | null, held = tasks(found)) =>
  new CompleteMergedTaskHandler(held, lines(), transaction, clock).execute(
    new CompleteMergedTaskCommand(MERGED),
  );

describe('CompleteMergedTask', () => {
  beforeEach(() => {
    saved = undefined;
  });

  it('stands the task at the end of its line', async () => {
    await merged(opened());

    expect(saved?.stationId).toEqual(StationId.of('station_2'));
    expect(saved?.finished).toBe(true);
  });

  it('says in the trail what ended it', async () => {
    await merged(opened());

    const last = saved?.notes[saved.notes.length - 1];
    expect(last?.body.value).toBe('The pull request was merged.');
    expect(last?.station.value).toBe('Code Review');
  });

  // A run still working it has nothing left to hand over.
  it('takes the task off whatever run was holding it', async () => {
    await merged(opened().handedTo(RunId.of('run_1')));

    expect(saved?.currentRunId).toBeNull();
  });

  // GitHub delivers a webhook more than once, and retries what it cannot
  // reach. Landing twice must read the same as landing once.
  it('changes nothing where the task already stands at the end', async () => {
    await merged(opened('station_2'));

    expect(saved?.notes).toEqual([]);
  });

  it('lets a pull request nobody here opened pass', async () => {
    await merged(null);

    expect(saved).toBeUndefined();
  });
});
