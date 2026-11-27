import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
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
import { SendTaskMessageHandler } from '@work/application/commands/handlers/send-task-message.handler';
import { StartTaskRunHandler } from '@work/application/commands/handlers/start-task-run.handler';
import { SendTaskMessageCommand } from '@work/application/commands/send-task-message.command';
import { StartTaskRunCommand } from '@work/application/commands/start-task-run.command';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { DraftSending } from '@work/application/services/draft-sending.service';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import { LineLoader } from '@work/application/services/line-loader.service';
import { MessageSending } from '@work/application/services/message-sending.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import {
  lineMapOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MEMBER = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: true,
});

const NOW = new Date('2026-11-20T09:00:00.000Z');
const OWNER = UserId.of('user_1');
const BOB = UserId.of('user_bob');
const ADMIN_OFF_THE_TEAM = 'user_admin';
const REVIEW = StationId.of('station_review');
const OUTSIDER = 'outsider';

const station = (
  id: string,
  name: string,
  position: number,
  extra: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase().split(' ').join('-')),
    name: StationName.of(name),
    position,
    color: '#a3a8b0',
    ...extra,
  });

const lineWith = (review: Partial<Parameters<typeof stationOf>[0]>) =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      station('station_backlog', 'Backlog', 0, { kind: 'backlog' }),
      station('station_review', 'Code Review', 1, {
        routes: routesOf({ stations: [], ends: true }),
        ...review,
      }),
      station('station_completed', 'Completed', 2, { kind: 'completed' }),
    ],
  });

const line = lineWith({ harness: HarnessId.of('dev') });

const waiting = () =>
  Task.add({
    line,
    at: REVIEW,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: OWNER,
    now: NOW,
    newId: () => 'task_1',
  }).notStartedOn(line);

let starts: RunId | null;
let saved: Task | undefined;

const world = (task: Task, at: LineMap = line) => {
  const access = workAccessSeeing(
    (_teamId, viewer) => viewer.value !== OUTSIDER,
    {
      members: [OWNER, BOB],
    },
  );
  const tasks = partial<TaskRepository>({
    find: vi.fn(() => Promise.resolve(task)),
    save: vi.fn((each: Task) => {
      saved = each;

      return Promise.resolve();
    }),
  });
  const lines = partial<LineMapsPort>({
    findByStation: vi.fn(() => Promise.resolve(at)),
  });
  const dispatch: TaskDispatching = { runIdFor: () => Promise.resolve(starts) };
  const transaction = {
    inTransaction: (work) => work(),
  } satisfies TransactionPort;
  const files = partial<FilesLoader>({
    handedOver: () => Promise.resolve([]),
    takenIn: () => Promise.resolve(undefined),
  });
  const drafts = new DraftSending(
    access,
    {
      writers: () => Promise.resolve([]),
      sent: () => Promise.resolve(undefined),
    },
    partial<LoggerPort>({ warn: () => undefined }),
  );
  const loader = new LineLoader(access, lines);

  return {
    send: (body: string, sentBy = OWNER.value) =>
      new SendTaskMessageHandler(
        tasks,
        loader,
        transaction,
        files,
        drafts,
        new MessageSending(
          tasks,
          lines,
          dispatch,
          partial<ClockPort>({ now: () => NOW }),
          files,
          access,
          drafts,
          { of: () => Promise.resolve([]) },
          { generate: () => 'hold_1' },
        ),
      ).execute(new SendTaskMessageCommand('team_1', 'task_1', sentBy, body)),
    start: (by = OWNER.value) =>
      new StartTaskRunHandler(tasks, loader, dispatch, transaction).execute(
        new StartTaskRunCommand('team_1', 'task_1', by),
      ),
  };
};

beforeEach(() => {
  starts = null;
  saved = undefined;
});

describe('a task whose agent did not start', () => {
  it('names the agent it could not start at the station', () => {
    expect(waiting().runNotStartedHere?.harness).toEqual(HarnessId.of('dev'));
    expect(waiting().runNotStartedHere?.stationId).toEqual(REVIEW);
  });

  it('starts the run on a message, and forgets why it did not start before', async () => {
    starts = RunId.of('run_2');

    await world(waiting()).send('Try with the new image.');

    expect(saved?.currentRunId?.value).toBe('run_2');
    expect(saved?.runNotStartedHere).toBeNull();
    expect(saved?.notes.map((note) => note.body.value)).toContain(
      'Try with the new image.',
    );
  });

  it('starts a line run on a message from another member or an admin off the team, and holds nothing', async () => {
    for (const sentBy of [BOB.value, ADMIN_OFF_THE_TEAM]) {
      starts = RunId.of('run_2');

      await world(waiting()).send('Try with the new image.', sentBy);

      expect(saved?.currentRunId?.value).toBe('run_2');
      expect(saved?.openHold).toBeNull();
      expect(saved?.assignee).toEqual(OWNER);
    }
  });

  it('keeps the message and says why again when the agent still does not start', async () => {
    await world(waiting()).send('Try with the new image.');

    expect(saved?.running).toBe(false);
    expect(saved?.runNotStartedHere?.harness).toEqual(HarnessId.of('dev'));
    expect(
      saved?.notes.some(
        (note) => note.body.value === 'Try with the new image.',
      ),
    ).toBe(true);
  });

  it('starts the run again on Try again, without a message', async () => {
    starts = RunId.of('run_2');

    await world(waiting()).start();

    expect(saved?.currentRunId?.value).toBe('run_2');
    expect(saved?.notes).toEqual(waiting().notes);
  });

  it('refuses Try again for a task that is not waiting for its run', async () => {
    const running = waiting().assignRun(RunId.of('run_1'), line);

    await expect(world(running).start()).rejects.toThrow(
      'Task task_1 is not waiting for its run to start.',
    );
    expect(saved).toBeUndefined();
  });

  it('forgets why the run did not start once the station has no agent', async () => {
    await world(waiting(), lineWith({})).start();

    expect(saved?.running).toBe(false);
    expect(saved?.runNotStarted).toBeNull();
  });

  it('refuses Try again while someone holds the task without a message', async () => {
    const turn = RunId.of('run_turn');
    const held = waiting()
      .heldOnMessage(
        null,
        {
          id: HoldId.of('hold_1'),
          members: TeamMembers.of([OWNER, UserId.of('maya')]),
          line,
          currentRunStarted: false,
          at: NOW,
        },
        {
          line,
          body: TaskNoteBody.of('Use a bounded queue.'),
          at: NOW,
          voice: Voice.person(UserId.of('maya')),
        },
        REVIEW,
        { person: UserId.of('maya'), team: MEMBER },
      )
      .assignRun(turn, line)
      .leaveRun(turn, NOW)
      .notStartedOn(line);

    await expect(world(held).start()).rejects.toThrow(
      'Task task_1 cannot start a run now. It waits on a person or is on hold.',
    );
    expect(saved).toBeUndefined();
  });

  it('lets no one outside the team message the task or start its run', async () => {
    await expect(world(waiting()).send('Hi', OUTSIDER)).rejects.toThrow(
      'Task task_1 not found.',
    );
    await expect(world(waiting()).start(OUTSIDER)).rejects.toThrow(
      'Task task_1 not found.',
    );
  });
});
