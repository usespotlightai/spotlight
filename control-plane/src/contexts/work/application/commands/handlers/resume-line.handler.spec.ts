import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
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
import { ResumeLineHandler } from '@work/application/commands/handlers/resume-line.handler';
import { ResumeLineCommand } from '@work/application/commands/resume-line.command';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { leasedRun } from '@work/application/ports/runs.fake-spec';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { LineLoader } from '@work/application/services/line-loader.service';
import { LineResuming } from '@work/application/services/line-resuming.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it, vi } from 'vitest';

const MEMBER = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: true,
});

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
    .heldOnMessage(
      null,
      {
        id: HoldId.of('hold_1'),
        members: TeamMembers.of([UserId.of('user_1')]),
        line,
        currentRunStarted: true,
        at: NOW,
      },
      {
        line,
        body: TaskNoteBody.of('Use a bounded queue.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_1')),
      },
      BUILD,
      { person: UserId.of('user_1'), team: MEMBER },
    )
    .assignRun(TURN, line)
    .putToAPerson(TURN, {
      line,
      body: TaskNoteBody.of('The queue is bounded now.'),
      at: NOW,
      voice: Voice.station(TURN),
    });

const people: PersonReaderPort = {
  find: (id) =>
    Promise.resolve(
      id.value === 'user_1' ? { id, name: 'Sam Lee', image: null } : null,
    ),
  findMany: () => Promise.resolve(new Map()),
};

const resumeLine = async (
  next: string,
  ended: readonly { path: string; commit: string }[],
  viewer = 'user_1',
  found: () => Task = driven,
): Promise<{ saved: Task | undefined; dispatched: boolean }> => {
  let saved: Task | undefined;
  let dispatched = false;
  const tasks = partial<TaskRepository>({
    find: vi.fn(() => Promise.resolve(found())),
    save: vi.fn((task: Task) => {
      saved = task;

      return Promise.resolve();
    }),
  });
  const dispatch: TaskDispatching = {
    runIdFor: () => {
      dispatched = true;
      return Promise.resolve(RunId.of('run_line_2'));
    },
  };
  const transaction: TransactionPort = {
    inTransaction: async (work) => work(),
  };
  const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
  const lines = new LineLoader(
    workAccessSeeing(() => true),
    partial<LineMapsPort>({
      find: () => Promise.resolve(line),
      findByStation: () => Promise.resolve(line),
    }),
  );
  const facts = {
    of: () =>
      Promise.resolve([
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
      ]),
  };

  await new ResumeLineHandler(
    tasks,
    lines,
    new LineResuming(
      { placementsAt: () => Promise.resolve([]) },
      facts,
      dispatch,
      clock,
    ),
    transaction,
    people,
  ).execute(
    new ResumeLineCommand('team_1', 'task_1', viewer, next, null, null, null),
  );

  return { saved, dispatched };
};

describe('ResumeLineHandler', () => {
  it('records the commits the turns started and ended on, and starts the station agent again', async () => {
    const { saved, dispatched } = await resumeLine('continue', [
      { path: '/workspace/app', commit: LAST },
    ]);
    const ended = saved?.holds[0];

    expect(saved?.onHold).toBe(false);
    expect(ended?.fromHeads.map((each) => each.commit)).toEqual([FIRST]);
    expect(ended?.toHeads.map((each) => each.commit)).toEqual([LAST]);
    expect(dispatched).toBe(true);
    expect(saved?.currentRunId?.value).toBe('run_line_2');
  });

  it('knows no end commits when the turns reported none', async () => {
    const { saved } = await resumeLine('continue', []);

    expect(saved?.holds[0]?.toHeads).toEqual([]);
  });

  it('finishes the task at the end of its line', async () => {
    const { saved, dispatched } = await resumeLine('finish', []);

    expect(saved?.finished).toBe(true);
    expect(dispatched).toBe(false);
  });

  it('lets a teammate resume the line for the person who put the task on hold', async () => {
    const { saved, dispatched } = await resumeLine('continue', [], 'user_2');

    expect(saved?.onHold).toBe(false);
    expect(saved?.holds[0]?.by.value).toBe('user_1');
    expect(dispatched).toBe(true);
  });

  it('says there is nothing to resume when the task is not on hold', async () => {
    await expect(
      resumeLine('continue', [], 'user_1', running),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message: 'Task task_1 is not on hold. There is nothing to resume.',
    });
  });
});
