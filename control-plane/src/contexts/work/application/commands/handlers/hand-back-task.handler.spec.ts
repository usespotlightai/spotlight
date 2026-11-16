import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
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
import { HandBackTaskCommand } from '@work/application/commands/hand-back-task.command';
import { HandBackTaskHandler } from '@work/application/commands/handlers/hand-back-task.handler';
import { leasedRun } from '@work/application/ports/runs.fake-spec';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { LineLoader } from '@work/application/services/line-loader.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TakeoverId } from '@work/domain/value-objects/takeover-id.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-16T09:00:00.000Z');
const BUILD = StationId.of('station_build');
const LINE_RUN = RunId.of('run_line');

const line = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationOf({
      id: StationId.of('station_backlog'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
    }),
    stationOf({
      id: BUILD,
      key: StationKey.of('build'),
      name: StationName.of('Build'),
      position: 1,
      color: '#a3a8b0',
      harness: HarnessId.of('dev'),
    }),
    stationOf({
      id: StationId.of('station_completed'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: '#a3a8b0',
      kind: 'completed',
    }),
  ],
});

const running = () =>
  Task.add({
    line,
    at: BUILD,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).assignRun(LINE_RUN, line);

const TURN = RunId.of('run_turn');
const FIRST = 'a'.repeat(40);
const LAST = 'b'.repeat(40);

const driven = () =>
  running()
    .takeOver({
      id: TakeoverId.of('takeover_1'),
      by: UserId.of('user_1'),
      members: TeamMembers.of([UserId.of('user_1')]),
      line,
      verdict: 'not-right',
      currentRunStarted: true,
      at: NOW,
    })
    .addMessage({
      line,
      body: TaskNoteBody.of('Use a bounded queue.'),
      at: NOW,
      voice: Voice.person(UserId.of('user_1')),
    })
    .assignRun(TURN, line)
    .putToAPerson(TURN, {
      line,
      body: TaskNoteBody.of('The queue is bounded now.'),
      at: NOW,
      voice: Voice.station(TURN),
    });

const people: PersonReaderPort = {
  find: async (id) =>
    id.value === 'user_1' ? { id, name: 'Sam Lee', image: null } : null,
  findMany: async () => new Map(),
};

const handBack = async (
  next: string,
  ended: readonly { path: string; commit: string }[],
  viewer = 'user_1',
  found: () => Task = driven,
): Promise<{ saved: Task | undefined; dispatched: boolean }> => {
  let saved: Task | undefined;
  let dispatched = false;
  const tasks = {
    find: vi.fn(async () => found()),
    save: vi.fn(async (task: Task) => {
      saved = task;
    }),
  } as unknown as TaskRepository;
  const dispatch: TaskDispatching = {
    runIdFor: async () => {
      dispatched = true;
      return RunId.of('run_line_2');
    },
  };
  const transaction: TransactionPort = {
    inTransaction: async (work) => work(),
  };
  const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
  const lines = new LineLoader(
    workAccessSeeing(() => true),
    {
      find: async () => line,
      findByStation: async () => line,
    } as never,
  );
  const facts = {
    of: async () => [
      leasedRun({
        runId: TURN,
        startedFrom: {
          archiveId: null,
          archiveStored: false,
          at: NOW,
          checkouts: [{ path: '/workspace/app', commit: FIRST }],
        },
        endHeads: ended,
      }),
    ],
  };

  await new HandBackTaskHandler(
    tasks,
    lines,
    { placementsAt: async () => [] },
    facts,
    transaction,
    dispatch,
    clock,
    people,
  ).execute(
    new HandBackTaskCommand('team_1', 'task_1', viewer, next, null, null, null),
  );

  return { saved, dispatched };
};

describe('HandBackTaskHandler', () => {
  it('records the commits the turns started and ended on, and starts the station agent again', async () => {
    const { saved, dispatched } = await handBack('continue', [
      { path: '/workspace/app', commit: LAST },
    ]);
    const ended = saved?.takeovers[0];

    expect(saved?.takenOver).toBe(false);
    expect(ended?.fromHeads.map((each) => each.commit)).toEqual([FIRST]);
    expect(ended?.toHeads.map((each) => each.commit)).toEqual([LAST]);
    expect(dispatched).toBe(true);
    expect(saved?.currentRunId?.value).toBe('run_line_2');
  });

  it('knows no end commits when the turns reported none', async () => {
    const { saved } = await handBack('continue', []);

    expect(saved?.takeovers[0]?.toHeads).toEqual([]);
  });

  it('finishes the task at the end of its line', async () => {
    const { saved, dispatched } = await handBack('finish', []);

    expect(saved?.finished).toBe(true);
    expect(dispatched).toBe(false);
  });

  it('says who has the task when someone else hands it back', async () => {
    await expect(handBack('continue', [], 'user_2')).rejects.toMatchObject({
      kind: 'conflict',
      message: 'Sam Lee took over this task. Only they can hand it back.',
    });
  });

  it('says nobody has the task when nobody took it over', async () => {
    await expect(
      handBack('continue', [], 'user_1', running),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message: 'Nobody took over this task. There is nothing to hand back.',
    });
  });
});
