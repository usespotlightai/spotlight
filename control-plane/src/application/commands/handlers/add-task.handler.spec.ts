import { AddTaskCommand } from '@application/commands/add-task.command';
import { AddTaskHandler } from '@application/commands/handlers/add-task.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { TaskBriefing } from '@domain/services/task-briefing';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
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
        id: StationId.of('station_0'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.create({
        id: StationId.of('station_1'),
        name: StationName.of('Triage'),
        position: 1,
        color: StationColor.of('#93a1b5'),
        harness: HarnessId.of('dev'),
        agentPrompt: AgentPrompt.of('## Role'),
      }),
      Station.create({
        id: StationId.of('station_2'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
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

let added: Task | undefined;

const tasks = () =>
  ({
    add: vi.fn(async (task: Task) => {
      added = task;
    }),
    save: vi.fn(),
    find: vi.fn(async () => null),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    withPullRequest: vi.fn(async () => null),
  }) satisfies TaskRepository;

const transaction: TransactionPort = { run: (work) => work() };

const lines = (found: AssemblyLine | null = line()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    holding: vi.fn(async () => found),
  }) satisfies AssemblyLineRepository;

const addTask = (
  command: AddTaskCommand,
  board: AssemblyLineRepository = lines(),
) =>
  new AddTaskHandler(
    tasks(),
    board,
    ids,
    clock,
    dispatch(),
    people,
    transaction,
  ).execute(command);

beforeEach(() => {
  added = undefined;
  dispatched.length = 0;
});

const raiser = { id: 'user_1', name: 'Ada', image: null };

const people: PersonReaderPort = { find: async () => raiser };

describe('AddTaskHandler', () => {
  it('hands back the task it added', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'line_1',
          'station_1',
          'Fix the queue',
          null,
          'user_1',
          null,
        ),
      ),
    ).resolves.toEqual({
      id: 'task_1',
      stationId: 'station_1',
      title: 'Fix the queue',
      description: null,
      createdAt: raised.toISOString(),
      rank: added?.rank.value,
      // Dispatched the moment it was raised, so it is already being worked.
      running: true,
      awaitingReview: null,
      repository: null,
      pullRequest: null,
      raisedBy: raiser,
      note: null,
    });
  });

  it('takes the workspace from the line, not from the caller', async () => {
    await addTask(
      new AddTaskCommand(
        'line_1',
        'station_1',
        'Fix the queue',
        null,
        'user_1',
        null,
      ),
    );

    expect(added?.workspaceId).toEqual(WorkspaceId.of('ws_1'));
  });

  it('keeps a description written in markdown', async () => {
    await addTask(
      new AddTaskCommand(
        'line_1',
        'station_1',
        'Fix it',
        '## Steps\n\nGo.',
        'user_1',
        null,
      ),
    );

    expect(added?.description?.value).toBe('## Steps\n\nGo.');
  });

  it('hands the task to a runner as soon as it is raised', async () => {
    await addTask(
      new AddTaskCommand(
        'line_1',
        'station_1',
        'Fix the queue',
        null,
        'user_1',
        null,
      ),
    );

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({ harness: 'dev', priority: 1 });
    expect(dispatched[0]?.brief).toContain('## Role\n\n## Fix the queue');
    expect(added?.currentRunId?.value).toBe('run_1');
  });

  it('holds work back at a station no runners answer for', async () => {
    await addTask(
      new AddTaskCommand(
        'line_1',
        'station_0',
        'Think about it',
        null,
        'user_1',
        null,
      ),
    );

    expect(dispatched).toEqual([]);
    expect(added?.currentRunId).toBeNull();
  });

  it('refuses a station the line does not hold', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'line_1',
          'station_missing',
          'Fix it',
          null,
          'user_1',
          null,
        ),
      ),
    ).rejects.toThrow(UseCaseFault);
  });

  it('refuses a line that does not exist', async () => {
    await expect(
      addTask(
        new AddTaskCommand(
          'line_missing',
          'station_1',
          'Fix it',
          null,
          'user_1',
          null,
        ),
        lines(null),
      ),
    ).rejects.toThrow(UseCaseFault);
  });

  it('refuses a task with no title', async () => {
    await expect(
      addTask(
        new AddTaskCommand('line_1', 'station_1', '   ', null, 'user_1', null),
      ),
    ).rejects.toThrow(UseCaseFault);
  });
});
