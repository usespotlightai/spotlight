import { AnalyseTraceCommand } from '@application/commands/analyse-trace.command';
import { AnalyseTraceHandler } from '@application/commands/handlers/analyse-trace.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { RaiseTask } from '@application/services/raise-task';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import type { Team } from '@domain/aggregates/team.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Placement } from '@domain/services/placement';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineRole } from '@domain/value-objects/line-role.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const now = new Date('2026-09-06T09:15:00.000Z');
const clock: ClockPort = { now: () => now, sleep: async () => {} };
const ids: IdGeneratorPort = { generate: () => 'task_new' };
const transaction: TransactionPort = { run: (work) => work() };

const requester = { id: 'user_1', name: 'Ada', image: null };
const people: PersonReaderPort = { find: async () => requester };

const improvementLine = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_improve'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Factory Improvement'),
    role: LineRole.IMPROVEMENT,
    stations: [
      Station.create({
        id: StationId.of('station_0'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.create({
        id: StationId.of('station_analysis'),
        name: StationName.of('Analysis'),
        position: 1,
        color: StationColor.of('#9b8cf0'),
        harness: HarnessId.of('dev'),
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

const traced = (workspaceId = 'ws_1') =>
  Task.add({
    workspaceId: WorkspaceId.of(workspaceId),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: Placement.atTheBack([]),
    now,
    newId: () => 'task_orig',
  });

const team = { id: TeamId.of('team_1'), workspaceId: WorkspaceId.of('ws_1') };

const teams = (holds = true) =>
  ({
    find: vi.fn(
      async () => ({ ...team, holds: () => holds }) as unknown as Team,
    ),
    save: vi.fn(),
  }) as unknown as TeamRepository;

let added: Task | undefined;

const tasks = (found: Task | null) =>
  ({
    add: vi.fn(async (task: Task) => {
      added = task;
    }),
    save: vi.fn(),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    holding: vi.fn(async () => null),
  }) satisfies TaskRepository;

const lines = (ofTeam: AssemblyLine[]) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => ofTeam[0] ?? null),
    holding: vi.fn(async () => null),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => ofTeam),
    withRole: vi.fn(
      async (_team, role) =>
        ofTeam.find((each) => each.role?.equals(role)) ?? null,
    ),
  }) satisfies AssemblyLineRepository;

const configurations = (repository: string | null) =>
  ({
    findFor: vi.fn(async () =>
      repository ? ({ repository: { value: repository } } as never) : null,
    ),
    save: vi.fn(),
  }) as unknown as TeamConfigurationRepository;

const dispatch: TaskDispatching = {
  dispatch: async () => RunId.of('run_1'),
};

const handler = (over: {
  found?: Task | null;
  ofTeam?: AssemblyLine[];
  holds?: boolean;
  repository?: string | null;
}) =>
  new AnalyseTraceHandler(
    tasks(over.found ?? traced()),
    lines(over.ofTeam ?? [improvementLine()]),
    teams(over.holds ?? true),
    configurations(over.repository ?? null),
    ids,
    clock,
    new RaiseTask(tasks(null), dispatch, transaction),
    people,
  );

const command = (taskIds: string[] = ['task_orig']) =>
  new AnalyseTraceCommand('team_1', taskIds, 'user_1');

beforeEach(() => {
  added = undefined;
});

describe('AnalyseTraceHandler', () => {
  it('opens an analysis task on the improvement line, given to whoever asked', async () => {
    const [created] = await handler({}).execute(command());

    expect(created?.title).toBe('Analyse trace: Fix the queue');
    expect(created?.description).toContain('spotlight trace --task task_orig');
    expect(created?.assignee).toEqual(requester);
    // At the line's entry — the first station work is done at.
    expect(added?.stationId).toEqual(StationId.of('station_analysis'));
    expect(added?.workspaceId).toEqual(WorkspaceId.of('ws_1'));
  });

  it('points the task at the configured repository', async () => {
    await handler({ repository: 'usespotlightai/spotlight' }).execute(
      command(),
    );

    expect(added?.repository?.value).toBe('usespotlightai/spotlight');
  });

  it('does nothing where the team has no improvement line', async () => {
    const created = await handler({ ofTeam: [] }).execute(command());

    expect(created).toEqual([]);
    expect(added).toBeUndefined();
  });

  it('says nothing of a trace in another team', async () => {
    const created = await handler({ found: traced('ws_2') }).execute(command());

    expect(created).toEqual([]);
    expect(added).toBeUndefined();
  });

  it('refuses someone who is not on the team', async () => {
    await expect(handler({ holds: false }).execute(command())).rejects.toThrow(
      UseCaseFault,
    );
  });
});
