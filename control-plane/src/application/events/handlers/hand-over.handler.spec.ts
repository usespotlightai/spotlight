import { HandOver } from '@application/events/handlers/hand-over.handler';
import type { ClockPort } from '@application/ports/clock.port';
import type { OutboundTaskNotifierPort } from '@application/ports/outbound-task-notifier.port';
import { SilentTaskNotifier } from '@application/ports/outbound-task-notifier.port';
import { AnnounceTaskEvents } from '@application/services/announce-task-events';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { Line } from '@domain/aggregates/line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import { RunCompleted } from '@domain/events/run-completed.event';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { Declaration } from '@domain/value-objects/declaration.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HandoverReport } from '@domain/value-objects/handover-report.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunOutcome } from '@domain/value-objects/run-outcome.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunSubject } from '@domain/value-objects/run-subject.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const aSpec = (executable = 'sh') =>
  RunSpec.of({
    command: { executable, args: [] },
    briefing: 'do the thing',
    handover: { options: [], noteLimit: 4_000 },
    continuity: { key: 'task:station', keep: true },
  });

const NOW = new Date('2026-08-28T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const at = (
  id: string,
  name: string,
  position: number,
  harness?: HarnessId,
  ends = false,
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase().split(' ').join('-')),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness,
    wayOut: WayOut.of({ ends }),
    kind:
      position === 0 ? 'backlog' : name === 'Completed' ? 'completed' : 'work',
  });

const line = () =>
  Line.of({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      at('station_0', 'Backlog', 0),
      at('station_1', 'Triage', 1, HarnessId.of('dev'), true),
      at('station_2', 'Spec', 2, HarnessId.of('dev')),
      at('station_3', 'Completed', 3),
    ],
  });

const task = (held = 'run_1') =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).handedTo(RunId.of(held));

const LATER = new Date(NOW.getTime() + 120_000);

const queued = (taskId: string | null = 'task_1') =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject: taskId ? RunSubject.task(TaskId.of(taskId), null) : null,
    spec: aSpec(),
  });

const run = (failed: boolean, said: HandoverReport = HandoverReport.none()) => {
  const runner = RunnerId.of('runner_1');

  return queued()
    .claim(runner, NOW)
    .complete(
      runner,
      RunOutcome.of({ exitCode: failed ? 1 : 0, failed }),
      said,
    );
};

const stoppedRun = () => {
  const runner = RunnerId.of('runner_1');

  return queued().claim(runner, NOW).complete(runner, RunOutcome.stopped(0));
};

const givenUp = () => {
  const runner = RunnerId.of('runner_1');
  let ended = queued();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    ended = ended.claim(runner, NOW).requeue(LATER);
  }
  return ended;
};

let saved: Task | undefined;

const tasks = (found: Task | null = task()) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    holding: vi.fn(async () => null),
    countsAt: vi.fn(async () => new Map()),
  }) satisfies TaskRepository;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    holding: vi.fn(async () => line()),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    withRole: vi.fn(async () => null),
  }) satisfies LineRepository;

const dispatch: TaskDispatching = {
  dispatch: async () => RunId.of('run_2'),
};

const announce = new AnnounceTaskEvents(new SilentTaskNotifier(), tasks());

const handOver = (ended = run(false), held: TaskRepository = tasks()) => {
  const handler = new HandOver(held, lines(), dispatch, clock, announce);
  const [raised] = ended.pullEvents();

  if (!raised) {
    throw new Error('the run announced nothing');
  }

  return raised instanceof RunCompleted
    ? handler.onRunCompleted(raised)
    : handler.onRunAbandoned(raised as RunAbandoned);
};

beforeEach(() => {
  saved = undefined;
});

describe('HandOver', () => {
  it('asks a person about a run that finished saying nothing', async () => {
    await handOver();

    expect(saved?.awaitingReview).toBe(true);
    expect(saved?.currentRunId).toBeNull();
    expect(saved?.notes.map((each) => each.body.value)).toEqual([
      'The run finished without saying where the task should go next.',
    ]);
  });

  it('asks a person about a run that failed, and says why', async () => {
    await handOver(run(true));

    expect(saved?.awaitingReview).toBe(true);
    expect(saved?.notes[0]?.body.value).toContain('The run failed');
  });

  it('brings a stopped run back to the person rather than advancing it', async () => {
    await handOver(stoppedRun());

    expect(saved?.awaitingReview).toBe(true);
    expect(saved?.currentRunId).toBeNull();
    expect(saved?.notes[0]?.body.value).toContain('Stopped from the console');
  });

  it('closes a task the run said was done', async () => {
    await handOver(
      run(
        false,
        HandoverReport.of({
          declared: Declaration.of({
            next: 'done',
            note: 'Pull request opened.',
          }),
        }),
      ),
    );

    expect(saved?.finished).toBe(true);
    expect(saved?.awaitingReview).toBe(false);
    expect(saved?.currentRunId).toBeNull();
    expect(saved?.notes[0]?.body.value).toBe('Pull request opened.');
  });

  it('names the station the note came from', async () => {
    await handOver();

    expect(saved?.notes[0]?.station.value).toBe('Triage');
  });

  it('leaves a task alone once another run has taken it', async () => {
    await handOver(run(false), tasks(task('run_9')));

    expect(saved).toBeUndefined();
  });

  it('leaves a run with no task of its own alone', async () => {
    const runner = RunnerId.of('runner_1');
    const loose = queued(null)
      .claim(runner, NOW)
      .complete(runner, RunOutcome.of({ exitCode: 0, failed: false }));

    await handOver(loose);

    expect(saved).toBeUndefined();
  });

  it('asks a person about a run nobody ever finished', async () => {
    await handOver(givenUp());

    expect(saved?.awaitingReview).toBe(true);
    expect(saved?.notes[0]?.body.value).toContain('3 attempts');
  });

  it('hands over even where the task has since gone missing', async () => {
    await expect(handOver(run(false), tasks(null))).resolves.toBeUndefined();
  });
  it('remembers the conversation the run worked in', async () => {
    await handOver(
      run(
        false,
        HandoverReport.of({ session: HarnessSession.of('session_1') }),
      ),
    );

    expect(saved?.sessionId?.value).toBe('session_1');
    expect(saved?.awaitingReview).toBe(true);
  });

  it('leaves the task without one when the runner reported none', async () => {
    await handOver();

    expect(saved?.sessionId).toBeNull();
  });

  it('records a returned mark onto the task read back, not the stale copy', async () => {
    const saves: Task[] = [];
    const moved = task().markedBy(Mark.of('test.moved-on', 'yes'));
    const reads = [task(), moved];

    const repo = {
      ...tasks(),
      save: vi.fn(async (each: Task) => {
        saves.push(each);
      }),
      find: vi.fn(async () => reads.shift() ?? moved),
    } as unknown as TaskRepository;

    const speaking: OutboundTaskNotifierPort = {
      notify: async () => [Mark.of('slack.thread', '170.9')],
    };

    const [raised] = run(false).pullEvents();
    await new HandOver(
      repo,
      lines(),
      dispatch,
      clock,
      new AnnounceTaskEvents(speaking, repo),
    ).onRunCompleted(raised as RunCompleted);

    const last = saves[saves.length - 1];
    expect(last?.marks.map((each) => each.kind)).toEqual(
      expect.arrayContaining(['test.moved-on', 'slack.thread']),
    );
  });
});
