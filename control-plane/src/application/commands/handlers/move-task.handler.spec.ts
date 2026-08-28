import { MoveTaskHandler } from '@application/commands/handlers/move-task.handler';
import { MoveTaskCommand } from '@application/commands/move-task.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { TransactionPort } from '@application/ports/transaction.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { run: (work) => work() };

const at = (id: string, name: string, position: number) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
  });

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [at('station_1', 'Backlog', 0), at('station_2', 'Triage', 1)],
  });

const standing = (stationId = 'station_2') =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    now: new Date('2026-08-27T09:15:00.000Z'),
    newId: () => 'task_1',
  });

let saved: Task | undefined;

const tasks = (found: Task | null = standing()) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (task: Task) => {
      saved = task;
    }),
    find: vi.fn(async () => found),
  }) satisfies TaskRepository;

const lines = (found: AssemblyLine | null = line()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
  }) satisfies AssemblyLineRepository;

const move = (
  stationId: string,
  board: AssemblyLineRepository = lines(),
  held: TaskRepository = tasks(),
) =>
  new MoveTaskHandler(held, board, transaction).execute(
    new MoveTaskCommand('line_1', 'task_1', stationId),
  );

beforeEach(() => {
  saved = undefined;
});

describe('MoveTaskHandler', () => {
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
