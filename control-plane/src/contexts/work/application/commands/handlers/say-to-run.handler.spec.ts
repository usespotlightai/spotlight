import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SayToRunHandler } from '@work/application/commands/handlers/say-to-run.handler';
import { SayToRunCommand } from '@work/application/commands/say-to-run.command';
import type { FilesAtHand } from '@work/application/services/files-at-hand.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const OWNER = UserId.of('user_1');
const RUN = RunId.of('run_1');
const REVIEW = StationId.of('station_review');

const station = (
  id: string,
  name: string,
  position: number,
  extra: Partial<Parameters<typeof Station.of>[0]> = {},
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase().split(' ').join('-')),
    name: StationName.of(name),
    position,
    color: StationColor.plain(),
    ...extra,
  });

const line = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station('station_backlog', 'Backlog', 0, { kind: 'backlog' }),
    station('station_review', 'Code Review', 1, {
      harness: HarnessId.of('dev'),
      wayOut: WayOut.of({ stations: [], ends: true }),
    }),
    station('station_completed', 'Completed', 2, { kind: 'completed' }),
  ],
});

const run = Run.enqueue({
  id: RUN,
  workspaceId: WorkspaceId.of('ws_1'),
  harness: HarnessId.of('dev'),
  spec: RunSpec.of({
    command: { executable: 'sh', args: [] },
    briefing: 'Review the change.',
    handover: { options: ['done'], noteLimit: 0 },
    continuity: { key: `task_1:${REVIEW.value}` },
  }),
  subject: RunSubject.task(TaskId.of('task_1'), REVIEW, TaskRevision.of(0)),
});

const stationSaid = (body: string) => ({
  station: StationName.of('Code Review'),
  body: TaskNoteBody.of(body),
  at: NOW,
  voice: Voice.station(RUN),
});

const held = () =>
  Task.add({
    line,
    at: REVIEW,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: OWNER,
    now: NOW,
    newId: () => 'task_1',
  }).handedTo(RUN, line);

const finished = () =>
  held().finishedHere(RUN, line, stationSaid('Opened the pull request.'));

const paused = () =>
  held().putToAPersonBy(RUN, stationSaid('Which queue should I drain?'));

let saved: Task | undefined;
const dispatched: Task[] = [];

const saying = (
  task: Task,
  body = 'Rename the flag too.',
  saidBy = OWNER.value,
  runnerFor: string | null = 'run_2',
) => {
  const dispatch: TaskDispatching = {
    runIdFor: async ({ task: wanting }) => {
      dispatched.push(wanting);
      return runnerFor ? RunId.of(runnerFor) : null;
    },
  };

  return new SayToRunHandler(
    { findById: vi.fn(async () => run) } as unknown as RunRepository,
    {
      find: vi.fn(async () => task),
      save: vi.fn(async (each: Task) => {
        saved = each;
      }),
    } as unknown as TaskRepository,
    { holding: vi.fn(async () => line) } as unknown as LineRepository,
    { run: (work) => work() } satisfies TransactionPort,
    dispatch,
    { now: () => NOW } as ClockPort,
    { handedOver: async () => [] } as unknown as FilesAtHand,
  ).execute(new SayToRunCommand(RUN.value, saidBy, body, []));
};

beforeEach(() => {
  saved = undefined;
  dispatched.length = 0;
});

describe('SayToRunHandler', () => {
  it('starts the station again when a person speaks in the run chat of a task finished there', async () => {
    await saying(finished());

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]?.stationId).toEqual(REVIEW);
    expect(saved?.currentRunId?.value).toBe('run_2');
    expect(saved?.finished).toBe(false);
    expect(saved?.undelivered.map((note) => note.body.value)).toEqual([
      'Rename the flag too.',
    ]);
  });

  it('keeps the person’s words for later when no runner takes the station up', async () => {
    await saying(finished(), 'Rename the flag too.', OWNER.value, null);

    expect(dispatched).toHaveLength(1);
    expect(saved?.running).toBe(false);
    expect(saved?.undelivered).toHaveLength(1);
  });

  it('hands the words to the run still working the task, starting no other', async () => {
    await saying(held());

    expect(dispatched).toEqual([]);
    expect(saved?.heldBy(RUN)).toBe(true);
    expect(saved?.undelivered.map((note) => note.body.value)).toEqual([
      'Rename the flag too.',
    ]);
  });

  it('takes the words as the answer a paused run waits on, resuming that run', async () => {
    await saying(paused(), 'The default one.');

    expect(dispatched).toEqual([]);
    expect(saved?.takesUp(RUN)).toBe(true);
    expect(saved?.pullEvents()).toContainEqual(
      new TaskAnswered(TaskId.of('task_1'), WorkspaceId.of('ws_1'), RUN),
    );
  });

  it('answers a conflict once the task has moved on from the run’s station, starting nothing', async () => {
    const closed = held().moveTo(
      line,
      StationId.of('station_completed'),
      TaskRank.of('j'),
      stationSaid('Closed.'),
      { mover: OWNER },
    );

    await expect(saying(closed)).rejects.toMatchObject({ kind: 'conflict' });
    expect(saved).toBeUndefined();
    expect(dispatched).toEqual([]);
  });

  it('refuses anyone the task is not assigned to, starting nothing', async () => {
    await expect(
      saying(finished(), 'Rename it.', 'someone_else'),
    ).rejects.toMatchObject({ kind: 'not-found' });
    expect(saved).toBeUndefined();
    expect(dispatched).toEqual([]);
  });
});
