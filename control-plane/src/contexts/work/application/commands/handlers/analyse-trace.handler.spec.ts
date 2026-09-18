import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AnalyseTraceCommand } from '@work/application/commands/analyse-trace.command';
import { AnalyseTraceHandler } from '@work/application/commands/handlers/analyse-trace.handler';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { RaiseTask } from '@work/application/services/raise-task';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const now = new Date('2026-09-06T09:15:00.000Z');
const clock: ClockPort = { now: () => now, sleep: async () => {} };
const ids: IdGeneratorPort = { generate: () => 'task_new' };
const transaction: TransactionPort = { run: (work) => work() };

const requester = { id: 'user_1', name: 'Ada', image: null };
const people: PersonReaderPort = {
  find: async () => requester,
  findMany: async () => new Map(),
};

const improvementLine = (workspaceId = 'ws_1') =>
  Line.rehydrate({
    id: LineId.of('line_improve'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Factory'),
    role: LineRole.IMPROVEMENT,
    stations: [
      Station.of({
        id: StationId.of('station_0'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_analysis'),
        key: StationKey.of('analysis'),
        name: StationName.of('Analysis'),
        position: 1,
        color: StationColor.of('#9b8cf0'),
        harness: HarnessId.of('dev'),
      }),
      Station.of({
        id: StationId.of('station_2'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const traced = (workspaceId = 'ws_1') =>
  Task.add({
    line: improvementLine(workspaceId),
    at: StationId.of('station_0'),
    title: TaskTitle.of('Fix the queue'),
    rank: Placement.atTheBack([]),
    now,
    newId: () => 'task_orig',
  });

const teams = (holds = true): TeamDirectoryPort => ({
  find: vi.fn(async () => ({
    id: TeamId.of('team_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    name: 'Platform',
    members: holds ? [UserId.of('user_1')] : [],
  })),
  inWorkspace: vi.fn(async () => []),
});

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
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = (ofTeam: Line[]) =>
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
  }) satisfies LineRepository;

const dispatch: TaskDispatching = {
  runIdFor: async () => RunId.of('run_1'),
};

const handler = (over: {
  found?: Task | null;
  ofTeam?: Line[];
  holds?: boolean;
}) =>
  new AnalyseTraceHandler(
    tasks(over.found ?? traced()),
    tasks(null),
    lines(over.ofTeam ?? [improvementLine()]),
    teams(over.holds ?? true),
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
    expect(added?.stationId).toEqual(StationId.of('station_analysis'));
    expect(added?.workspaceId).toEqual(WorkspaceId.of('ws_1'));
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
