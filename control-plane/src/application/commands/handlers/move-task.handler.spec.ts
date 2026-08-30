import { MoveTaskHandler } from '@application/commands/handlers/move-task.handler';
import { MoveTaskCommand } from '@application/commands/move-task.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { TaskBriefing } from '@domain/services/task-briefing';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { run: (work) => work() };

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
      at('station_1', 'Backlog', 0),
      at('station_2', 'Triage', 1, HarnessId.of('dev')),
    ],
  });

const standing = (stationId = 'station_2') =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-27T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const dispatched: { harness: string; priority: number; brief: string }[] = [];

const dispatch = (runId: string | null = 'run_1'): TaskDispatchPort => ({
  dispatch: async ({ task, line }) => {
    const station = line.stationAt(task.stationId);

    if (!station?.harness) {
      return null;
    }
    dispatched.push({
      harness: station.harness.value,
      priority: station.position,
      brief: TaskBriefing.brief({ task, line }),
    });
    return runId === null ? null : RunId.of(runId);
  },
});

let saved: Task | undefined;

const tasks = (found: Task | null = standing()) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (task: Task) => {
      saved = task;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
  }) satisfies TaskRepository;

const lines = (found: AssemblyLine | null = line()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    holding: vi.fn(async () => found),
  }) satisfies AssemblyLineRepository;

const clock: ClockPort = {
  now: () => new Date('2026-08-29T12:00:00.000Z'),
  sleep: async () => {},
};

const people: PersonReaderPort = {
  find: async () => ({ id: 'user_1', name: 'Ada', image: null }),
};

const move = (
  stationId: string,
  board: AssemblyLineRepository = lines(),
  held: TaskRepository = tasks(),
) =>
  new MoveTaskHandler(
    held,
    board,
    transaction,
    dispatch(),
    clock,
    people,
  ).execute(new MoveTaskCommand('line_1', 'task_1', stationId, null));

beforeEach(() => {
  saved = undefined;
  dispatched.length = 0;
});

describe('MoveTaskHandler', () => {
  it('answers with the person who raised it, not with nobody', async () => {
    await expect(move('station_2')).resolves.toMatchObject({
      raisedBy: { id: 'user_1', name: 'Ada', image: null },
    });
  });

  it('stands the task at the station it was moved to', async () => {
    await move('station_1');

    expect(saved?.stationId).toEqual(StationId.of('station_1'));
  });

  it('hands back the task as it now stands', async () => {
    await expect(move('station_1')).resolves.toMatchObject({
      id: 'task_1',
      stationId: 'station_1',
      title: 'Fix the queue',
    });
  });

  it('hands the task over when it arrives at a worked station', async () => {
    await move('station_2', lines(), tasks(standing('station_1')));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({ harness: 'dev', priority: 1 });
    expect(dispatched[0]?.brief).toContain('## Fix the queue');
    expect(saved?.currentRunId?.value).toBe('run_1');
  });

  it('hands nothing over for a move within the same station', async () => {
    await move('station_2', lines(), tasks(standing('station_2')));

    expect(dispatched).toEqual([]);
  });

  it('holds work back at a station no runners answer for', async () => {
    await move('station_1', lines(), tasks(standing('station_2')));

    expect(dispatched).toEqual([]);
    expect(saved?.currentRunId).toBeNull();
  });

  it('refuses a station that is not on this line', async () => {
    await expect(move('station_elsewhere')).rejects.toThrow(UseCaseFault);
  });

  it('refuses to move a task standing on another line', async () => {
    await expect(
      move('station_1', lines(), tasks(standing('station_elsewhere'))),
    ).rejects.toThrow(UseCaseFault);
  });

  it('refuses a task that does not exist', async () => {
    await expect(move('station_1', lines(), tasks(null))).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('refuses a line that does not exist', async () => {
    await expect(move('station_1', lines(null))).rejects.toThrow(UseCaseFault);
  });
});
