import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { MoveTaskHandler } from '@work/application/commands/handlers/move-task.handler';
import { MoveTaskCommand } from '@work/application/commands/move-task.command';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { TaskBriefing } from '@work/application/rendering/task-briefing';
import { LineAtHand } from '@work/application/services/line-at-hand.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { run: (work) => work() };

const at = (id: string, name: string, position: number, harness?: HarnessId) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase().split(' ').join('-')),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness,
    kind:
      position === 0 ? 'backlog' : name === 'Completed' ? 'completed' : 'work',
  });

const line = () =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      at('station_1', 'Backlog', 0),
      at('station_2', 'Triage', 1, HarnessId.of('dev')),
      at('station_3', 'Completed', 2),
    ],
  });

const elsewhere = () =>
  Line.rehydrate({
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

const standing = (stationId = 'station_2', on = line()) =>
  Task.add({
    line: on,
    at: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-27T09:15:00.000Z'),
    newId: () => 'task_1',
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
        task,
        line,
        skills: [],
        listedIn: null,
        decisions: [],
        memories: [],
      }),
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
    holding: vi.fn(async () => null),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = (found: Line | null = line()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    holding: vi.fn(async () => found),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
  }) satisfies LineRepository;

const access = (teamId = 'team_1') =>
  ({
    onTeam: vi.fn(async (asked: string) =>
      asked === teamId
        ? {
            teamId: TeamId.of(teamId),
            workspaceId: WorkspaceId.of('ws_1'),
            slug: 'acme',
            viewer: UserId.of('user_1'),
            administers: false,
          }
        : null,
    ),
  }) as unknown as WorkspaceAccessPort;

const clock: ClockPort = {
  now: () => new Date('2026-08-29T12:00:00.000Z'),
  sleep: async () => {},
};

const people: PersonReaderPort = {
  find: async () => ({ id: 'user_1', name: 'Ada', image: null }),
  findMany: async () => new Map(),
};

const move = (
  stationId: string,
  board: LineRepository = lines(),
  held: TaskRepository & TaskPlacementsPort = tasks(),
  teamId = 'team_1',
  revision = 0,
) =>
  new MoveTaskHandler(
    held,
    held,
    new LineAtHand(access(), board),
    transaction,
    dispatch(),
    clock,
    people,
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
    await expect(move('station_1')).resolves.toMatchObject({ revision: 1 });
    expect(saved?.revision).toBe(1);
  });

  it('refuses a move based on a revision the task has moved on from', async () => {
    await expect(
      move('station_1', lines(), tasks(), 'team_1', 4),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(saved).toBeUndefined();
  });

  it('refuses a revision that is no whole number of moves', async () => {
    await expect(
      move('station_1', lines(), tasks(), 'team_1', -1),
    ).rejects.toMatchObject({ kind: 'invalid-input' });
  });

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

  it('lets go of the run working it, so that run is stopped, before handing it to a new one', async () => {
    const working = Task.rehydrate({
      ...standing('station_1'),
      currentRunId: RunId.of('run_0'),
    });

    await move('station_2', lines(), tasks(working));

    expect(saved?.currentRunId?.value).toBe('run_1');
    expect(
      saved
        ?.pullEvents()
        .map((each) =>
          each.kind === 'task.let-go-of-run' ||
          each.kind === 'task.handed-to-run'
            ? [each.kind, (each as TaskLetGoOfRun).runId.value]
            : [each.kind],
        ),
    ).toEqual([
      ['task.moved'],
      ['task.let-go-of-run', 'run_0'],
      ['task.handed-to-run', 'run_1'],
    ]);
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
      move(
        'station_1',
        lines(),
        tasks(standing('station_elsewhere', elsewhere())),
      ),
    ).rejects.toThrow(UseCaseFault);
  });

  it('refuses a task that does not exist', async () => {
    await expect(move('station_1', lines(), tasks(null))).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('refuses a line of a team the mover does not stand on', async () => {
    await expect(move('station_1', lines(), tasks(), 'team_2')).rejects.toThrow(
      UseCaseFault,
    );
    expect(saved).toBeUndefined();
  });

  it('refuses a line that does not exist', async () => {
    await expect(move('station_1', lines(null))).rejects.toThrow(UseCaseFault);
  });

  it('gives unclaimed work to whoever moves it from the backlog into active', async () => {
    await move('station_2', lines(), tasks(standing('station_1').unassigned()));

    expect(saved?.assignee?.value).toBe('user_mover');
  });

  it('leaves work its owner already holds with them when moved active', async () => {
    const owned = standing('station_1').assignedTo(UserId.of('user_other'));

    await move('station_2', lines(), tasks(owned));

    expect(saved?.assignee?.value).toBe('user_other');
  });

  it('assigns nobody when the move is not out of the backlog', async () => {
    await move('station_3', lines(), tasks(standing('station_2').unassigned()));

    expect(saved?.assignee).toBeNull();
  });
});
