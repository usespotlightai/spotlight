import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { MoveTaskHandler } from '@work/application/commands/handlers/move-task.handler';
import { MoveTaskCommand } from '@work/application/commands/move-task.command';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { TaskBriefing } from '@work/application/rendering/task-briefing';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { LineLoader } from '@work/application/services/line-loader.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { inTransaction: (work) => work() };

const at = (id: string, name: string, position: number, harness?: HarnessId) =>
  stationOf({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase().split(' ').join('-')),
    name: StationName.of(name),
    position,
    color: '#a3a8b0',
    harness,
    kind:
      position === 0 ? 'backlog' : name === 'Completed' ? 'completed' : 'work',
  });

const line = () =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      at('station_1', 'Backlog', 0),
      at('station_2', 'Triage', 1, HarnessId.of('dev')),
      at('station_4', 'Spec', 2, HarnessId.of('dev')),
      at('station_3', 'Completed', 3),
    ],
  });

const elsewhere = () =>
  lineMapOf({
    id: LineId.of('line_2'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('ops'),
    name: LineName.of('Ops'),
    stations: [
      at('station_elsewhere', 'Backlog', 0),
      at('station_closed', 'Completed', 1),
    ],
  });

const taskAt = (stationId = 'station_2', on = line()) =>
  Task.add({
    line: on,
    at: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: new Date('2026-08-27T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const landedAt = (stationId: string) =>
  Task.rehydrate({
    ...taskAt('station_1'),
    stationId: StationId.of(stationId),
  });

const dispatched: { harness: string; priority: number; brief: string }[] = [];

const dispatch = (runId: string | null = 'run_1'): TaskDispatching => ({
  runIdFor: async ({ task, line }) => {
    const station = line.stationAt(task.stationId);

    if (!station?.harness) {
      return null;
    }
    dispatched.push({
      harness: station.harness.value,
      priority: station.position,
      brief: TaskBriefing.brief({
        task: task.briefed,
        line,
        skills: [],
        listedIn: null,
        memories: [],
        memoryFolder: null,
        tools: [],
      }),
    });
    return runId === null ? null : RunId.of(runId);
  },
});

let saved: Task | undefined;

const tasks = (found: Task | null = taskAt()) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (task: Task) => {
      saved = task;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    placementsAt: vi.fn(async () => []),
    findByCorrelation: vi.fn(async () => []),
    holdingMark: vi.fn(async () => []),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    withTurnAnsweredBetween: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = (found: LineMap | null = line()) =>
  ({
    find: vi.fn(async () => found),
    findByStation: vi.fn(async () => found),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    candidate: vi.fn(),
  }) satisfies LineMapsPort;

const access = (teamId = 'team_1') =>
  workAccessSeeing((requested) => requested.value === teamId);

const clock: ClockPort = {
  now: () => new Date('2026-08-29T12:00:00.000Z'),
  sleep: async () => {},
};

const move = (
  stationId: string,
  board: LineMapsPort = lines(),
  stored: TaskRepository & TaskPlacementsPort = tasks(),
  teamId = 'team_1',
  revision = 0,
  seen = access(),
) =>
  new MoveTaskHandler(
    stored,
    stored,
    new LineLoader(seen, board),
    transaction,
    dispatch(),
    clock,
  ).execute(
    new MoveTaskCommand(
      teamId,
      'line_1',
      'task_1',
      stationId,
      revision,
      null,
      'user_mover',
    ),
  );

beforeEach(() => {
  saved = undefined;
  dispatched.length = 0;
});

describe('MoveTaskHandler', () => {
  it('moves a task on from the revision it was seen at, and counts the move', async () => {
    await move('station_1');

    expect(saved?.revision.value).toBe(1);
  });

  it('rejects a move based on a revision the task has moved on from', async () => {
    await expect(
      move('station_1', lines(), tasks(), 'team_1', 4),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(saved).toBeUndefined();
  });

  it('rejects a revision that is no whole number of moves', async () => {
    await expect(
      move('station_1', lines(), tasks(), 'team_1', -1),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('puts the task at the station it was moved to', async () => {
    await move('station_1');

    expect(saved?.stationId).toEqual(StationId.of('station_1'));
  });

  it('hands the task over when it arrives at a worked station', async () => {
    await move('station_2', lines(), tasks(taskAt('station_1')));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({ harness: 'dev', priority: 1 });
    expect(dispatched[0]?.brief).toContain('## Fix the queue');
    expect(saved?.currentRunId?.value).toBe('run_1');
  });

  it('detaches the run working it, so that run is stopped, before it assigns a new one', async () => {
    const working = Task.rehydrate({
      ...taskAt('station_1'),
      currentRunId: RunId.of('run_0'),
    });

    await move('station_2', lines(), tasks(working));

    expect(saved?.currentRunId?.value).toBe('run_1');
    expect(
      saved
        ?.pullEvents()
        .map((each) =>
          each.kind === 'task.run-detached' || each.kind === 'task.run-assigned'
            ? [each.kind, (each as TaskRunDetached).runId.value]
            : [each.kind],
        ),
    ).toEqual([
      ['task.moved'],
      ['task.run-detached', 'run_0'],
      ['task.acted-on'],
      ['task.run-assigned', 'run_1'],
    ]);
  });

  it('hands nothing over for a move within the same station', async () => {
    await move('station_2', lines(), tasks(taskAt('station_2')));

    expect(dispatched).toEqual([]);
  });

  it('keeps work back at a station no runners answer for', async () => {
    await move('station_1', lines(), tasks(taskAt('station_2')));

    expect(dispatched).toEqual([]);
    expect(saved?.currentRunId).toBeNull();
  });

  it('denies a person moving work between work stations, and saves nothing', async () => {
    await expect(
      move('station_4', lines(), tasks(taskAt('station_2'))),
    ).rejects.toMatchObject({
      kind: 'invalid',
      message: expect.stringContaining('from Triage to Spec'),
    });
    expect(saved).toBeUndefined();
    expect(dispatched).toEqual([]);
  });

  it('denies a person moving a completed task back out', async () => {
    await expect(
      move('station_1', lines(), tasks(landedAt('station_3'))),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(saved).toBeUndefined();
  });

  it('lets a person close a task from the backlog', async () => {
    await move('station_3', lines(), tasks(taskAt('station_1')));

    expect(saved?.stationId).toEqual(StationId.of('station_3'));
  });

  it('rejects a station that is not on this line', async () => {
    await expect(move('station_elsewhere')).rejects.toThrow(ApplicationError);
  });

  it('does not move a task on another line', async () => {
    await expect(
      move(
        'station_1',
        lines(),
        tasks(taskAt('station_elsewhere', elsewhere())),
      ),
    ).rejects.toThrow(ApplicationError);
  });

  it('rejects a task that does not exist', async () => {
    await expect(move('station_1', lines(), tasks(null))).rejects.toThrow(
      ApplicationError,
    );
  });

  it('rejects a line of a team the mover is not a member of', async () => {
    await expect(move('station_1', lines(), tasks(), 'team_2')).rejects.toThrow(
      ApplicationError,
    );
    expect(saved).toBeUndefined();
  });

  it('refuses a workspace member who sees the team but is not on it, moving nothing', async () => {
    await expect(
      move(
        'station_2',
        lines(),
        tasks(),
        'team_1',
        0,
        workAccessSeeing((requested) => requested.value === 'team_1', {
          onTeam: () => false,
        }),
      ),
    ).rejects.toMatchObject({
      refusal: expect.any(TeamMembershipRequiredError),
    });
    expect(saved).toBeUndefined();
  });

  it('rejects a line that does not exist', async () => {
    await expect(move('station_1', lines(null))).rejects.toThrow(
      ApplicationError,
    );
  });

  it('gives unclaimed work to whoever moves it from the backlog into active', async () => {
    await move('station_2', lines(), tasks(taskAt('station_1').unassign()));

    expect(saved?.assignee?.value).toBe('user_mover');
  });

  it('leaves work its owner already has with them when moved active', async () => {
    const owned = taskAt('station_1').assign(
      UserId.of('user_other'),
      TeamMembers.of([UserId.of('user_other')]),
    );

    await move('station_2', lines(), tasks(owned));

    expect(saved?.assignee?.value).toBe('user_other');
  });

  it('assigns nobody when the move is not out of the backlog', async () => {
    await move('station_3', lines(), tasks(taskAt('station_2').unassign()));

    expect(saved?.assignee).toBeNull();
  });
});
