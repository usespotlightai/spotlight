import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { CustomiseStationHandler } from '@application/commands/handlers/customise-station.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { TransactionPort } from '@application/ports/transaction.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import { Task } from '@domain/aggregates/task.aggregate';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { run: (work) => work() };

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
        description: StationDescription.of('Where new work lands'),
        harness: HarnessId.of('dev'),
        agentPrompt: AgentPrompt.of('## Role'),
      }),
    ],
  });

let saved: AssemblyLine | undefined;

const repository = (found: AssemblyLine | null = line()) =>
  ({
    add: vi.fn(),
    find: vi.fn(async () => found),
    holding: vi.fn(async () => found),
    save: vi.fn(async (updated: AssemblyLine) => {
      saved = updated;
    }),
  }) satisfies AssemblyLineRepository;

let standing: Task[] = [];
let handedOver: Task[] = [];

const tasks = () =>
  ({
    standingAt: vi.fn(async () => standing),
    save: vi.fn(async (task: Task) => {
      handedOver.push(task);
    }),
  }) as unknown as TaskRepository;

const waiting = (id: string) =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of(`Task ${id}`),
    rank: TaskRank.of('i'),
    now: new Date('2026-08-28T12:00:00.000Z'),
    newId: () => id,
  });

const dispatched = vi.fn(async () => RunId.of('run_1'));
const dispatch = { dispatch: dispatched } as unknown as TaskDispatchPort;

const customise = (
  changes: CustomiseStationCommand['changes'],
  lines: AssemblyLineRepository = repository(),
) =>
  new CustomiseStationHandler(lines, tasks(), dispatch, transaction).execute(
    new CustomiseStationCommand('line_1', 'station_1', changes),
  );

describe('CustomiseStationHandler', () => {
  it('hands back the station as it now stands', async () => {
    await expect(customise({ name: 'Intake' })).resolves.toEqual({
      id: 'station_1',
      name: 'Intake',
      position: 0,
      color: '#a3a8b0',
      description: 'Where new work lands',
      harness: 'dev',
      agentPrompt: '## Role',
    });
  });

  it('leaves alone every field the caller left out', async () => {
    await customise({ harness: 'gpu' });

    expect(saved?.stations[0]?.description?.value).toBe('Where new work lands');
    expect(saved?.stations[0]?.harness?.value).toBe('gpu');
  });

  it('repaints the station when a colour is given', async () => {
    const station = await customise({ color: '#5C66D9' });

    expect(station.color).toBe('#5c66d9');
  });

  it('refuses a colour that is not a hex', async () => {
    await expect(customise({ color: 'blue' })).rejects.toThrow(UseCaseFault);
  });

  it('clears a field sent as null', async () => {
    const station = await customise({ harness: null });

    expect(station.harness).toBeNull();
  });

  it('refuses a field that is nothing but whitespace', async () => {
    await expect(customise({ description: '   ' })).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('refuses a name emptied to blank, having nothing to fall back to', async () => {
    await expect(customise({ name: '  ' })).rejects.toThrow(UseCaseFault);
  });

  it('refuses a line that does not exist', async () => {
    await expect(customise({ harness: 'dev' }, repository(null))).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('answers with the station untouched when the change asks nothing', async () => {
    const station = await customise({});

    expect(station).toEqual({
      id: 'station_1',
      name: 'Triage',
      position: 0,
      color: '#a3a8b0',
      description: 'Where new work lands',
      harness: 'dev',
      agentPrompt: '## Role',
    });
  });

  // Dispatch otherwise only happens as a task arrives, so work added while
  // nobody worked the station would stand there until it was moved by hand.
  it('takes up the work already standing when a harness is given', async () => {
    standing = [waiting('task_1')];
    handedOver = [];
    dispatched.mockClear();

    await customise({ harness: 'claude-code' });

    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(handedOver[0]?.currentRunId?.value).toBe('run_1');
  });

  it('leaves the standing work alone when the station is set to nobody', async () => {
    standing = [waiting('task_1')];
    dispatched.mockClear();

    await customise({ harness: null });

    expect(dispatched).not.toHaveBeenCalled();
  });

  // Not only when the harness changes: a station that can work and has idle
  // work standing at it is a state worth repairing whenever we are here.
  it('takes up idle work on any change, not only a change of harness', async () => {
    standing = [waiting('task_1')];
    dispatched.mockClear();

    await customise({ name: 'Sorting' });

    expect(dispatched).toHaveBeenCalledTimes(1);
  });

  it('leaves a task that is already running to its run', async () => {
    standing = [waiting('task_1').handedTo(RunId.of('run_already'))];
    dispatched.mockClear();

    await customise({ harness: 'claude-code' });

    expect(dispatched).not.toHaveBeenCalled();
  });
});