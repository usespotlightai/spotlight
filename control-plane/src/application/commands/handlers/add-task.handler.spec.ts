import { AddTaskCommand } from '@application/commands/add-task.command';
import { AddTaskHandler } from '@application/commands/handlers/add-task.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ids: IdGeneratorPort = { generate: () => 'task_1' };

const raised = new Date('2026-08-27T09:15:00.000Z');
const clock: ClockPort = { now: () => raised, sleep: async () => {} };

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      Station.create({
        id: StationId.of('station_1'),
        name: StationName.of('Triage'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
      }),
    ],
  });

let added: Task | undefined;

const tasks = () =>
  ({
    add: vi.fn(async (task: Task) => {
      added = task;
    }),
    save: vi.fn(),
    find: vi.fn(async () => null),
    standingAt: vi.fn(async () => []),
  }) satisfies TaskRepository;

const lines = (found: AssemblyLine | null = line()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
  }) satisfies AssemblyLineRepository;

const addTask = (
  command: AddTaskCommand,
  board: AssemblyLineRepository = lines(),
) => new AddTaskHandler(tasks(), board, ids, clock).execute(command);

beforeEach(() => {
  added = undefined;
});

describe('AddTaskHandler', () => {
  it('hands back the task it added', async () => {
    await expect(
      addTask(new AddTaskCommand('line_1', 'station_1', 'Fix the queue', null)),
    ).resolves.toEqual({
      id: 'task_1',
      stationId: 'station_1',
      title: 'Fix the queue',
      description: null,
      createdAt: raised.toISOString(),
      rank: added?.rank.value,
    });
  });

  it('takes the workspace from the line, not from the caller', async () => {
    await addTask(
      new AddTaskCommand('line_1', 'station_1', 'Fix the queue', null),
    );

    expect(added?.workspaceId).toEqual(WorkspaceId.of('ws_1'));
  });

  it('keeps a description written in markdown', async () => {
    await addTask(
      new AddTaskCommand('line_1', 'station_1', 'Fix it', '## Steps\n\nGo.'),
    );

    expect(added?.description?.value).toBe('## Steps\n\nGo.');
  });

  it('refuses a station the line does not hold', async () => {
    await expect(
      addTask(new AddTaskCommand('line_1', 'station_missing', 'Fix it', null)),
    ).rejects.toThrow(UseCaseFault);
  });

  it('refuses a line that does not exist', async () => {
    await expect(
      addTask(
        new AddTaskCommand('line_missing', 'station_1', 'Fix it', null),
        lines(null),
      ),
    ).rejects.toThrow(UseCaseFault);
  });

  it('refuses a task with no title', async () => {
    await expect(
      addTask(new AddTaskCommand('line_1', 'station_1', '   ', null)),
    ).rejects.toThrow(UseCaseFault);
  });
});
