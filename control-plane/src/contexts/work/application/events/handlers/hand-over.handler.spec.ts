import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { HandOver } from '@work/application/events/handlers/hand-over.handler';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
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
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const aSpec = (executable = 'sh') =>
  RunSpec.of({
    command: { executable, args: [] },
    briefing: 'do the thing',
    handover: { options: [], noteLimit: 4_000 },
    continuity: { key: 'task:station' },
  });

const NOW = new Date('2026-08-28T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const at = (
  id: string,
  name: string,
  position: number,
  harness?: HarnessId,
  ends = false,
  passesTo: readonly string[] = [],
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase().split(' ').join('-')),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness,
    wayOut: WayOut.of({ ends, stations: passesTo.map(StationId.of) }),
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
      at('station_0', 'Backlog', 0),
      at('station_1', 'Triage', 1, HarnessId.of('dev'), true, ['station_2']),
      at('station_2', 'Spec', 2, HarnessId.of('dev')),
      at('station_4', 'Build', 3, HarnessId.of('dev')),
      at('station_3', 'Completed', 4),
    ],
  });

const task = (runId = 'run_1') =>
  Task.add({
    line: line(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).assignRun(RunId.of(runId), line());

const LATER = new Date(NOW.getTime() + 120_000);

const queued = (taskId: string | null = 'task_1') =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject: taskId
      ? RunSubject.task(TaskId.of(taskId), null, TaskRevision.of(0))
      : null,
    spec: aSpec(),
  });

const run = (
  failed: boolean,
  report: HandoverReport = HandoverReport.none(),
) => {
  const runner = RunnerId.of('runner_1');

  return queued()
    .claim(runner, NOW)
    .complete(
      runner,
      RunOutcome.of({ exitCode: failed ? 1 : 0, failed }),
      report,
    );
};

const stoppedRun = () => {
  const runner = RunnerId.of('runner_1');

  return queued().claim(runner, NOW).complete(runner, RunOutcome.stopped(0));
};

const exhausted = () => {
  const runner = RunnerId.of('runner_1');
  let ended = queued();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    ended.pullEvents();
    ended = ended.claim(runner, NOW).expireLease(LATER);
  }
  return ended;
};

const timedOut = () => {
  const runner = RunnerId.of('runner_1');
  let ended = queued();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    ended.pullEvents();
    ended =
      attempt < 2
        ? ended.claim(runner, NOW).expireLease(LATER)
        : ended.claim(runner, NOW).timedOut(runner, NOW);
  }
  return ended;
};

let saved: Task | undefined;
let savedRun: Run | undefined;
let storedRun: Run | null = null;

const runs = {
  findById: vi.fn(async () => storedRun),
  save: vi.fn(async (each: Run) => {
    savedRun = each;
  }),
} as unknown as RunRepository;

const tasks = (found: Task | null = task()) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    allAtStation: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    findByMarks: vi.fn(async () => null),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    findByStation: vi.fn(async () => line()),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
  }) satisfies LineRepository;

const dispatch: TaskDispatching = {
  runIdFor: async () => RunId.of('run_2'),
};

const handOver = (ended = run(false), stored: TaskRepository = tasks()) => {
  const handler = new HandOver(
    stored,
    runs,
    stored as TaskRepository & TaskPlacementsPort,
    lines(),
    dispatch,
    clock,
  );
  storedRun = ended;
  const [raised] = ended.pullEvents();

  if (!raised) {
    throw new Error('the run announced nothing');
  }

  return raised instanceof RunCompleted
    ? handler.onRunCompleted(raised)
    : handler.onRunExhausted(raised as RunExhausted);
};

beforeEach(() => {
  saved = undefined;
  savedRun = undefined;
  storedRun = null;
});

describe('HandOver', () => {
  it('asks a person about a run that finished without a handover', async () => {
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
    expect(saved?.notes[0]?.form).toBe('failure');
    expect(saved?.notes[0]?.failure).toMatchObject({
      source: 'run',
      code: 'exited',
      occurrences: 1,
    });
  });

  it('supersedes a failed run whose task moved on, and asks nobody about it', async () => {
    await handOver(run(true), tasks(task('run_9')));

    expect(saved).toBeUndefined();
    expect(savedRun?.state).toBe('superseded');
    expect(savedRun?.outcome?.failure?.code).toBe('superseded');
  });

  it('does not hand over a task whose current run was given a revision it has since moved on from', async () => {
    const runner = RunnerId.of('runner_1');
    const stale = Run.enqueue({
      id: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      harness: HarnessId.of('dev'),
      subject: RunSubject.task(TaskId.of('task_1'), null, TaskRevision.of(3)),
      spec: aSpec(),
    })
      .claim(runner, NOW)
      .complete(runner, RunOutcome.of({ exitCode: 1, failed: true }));

    await expect(handOver(stale)).rejects.toThrow(InconsistentStateError);

    expect(saved).toBeUndefined();
    expect(savedRun).toBeUndefined();
  });

  it('keeps a failure on a finished task from the inbox', async () => {
    const finished = task().finishHere(RunId.of('run_1'), line(), {
      station: StationName.of('Triage'),
      body: TaskNoteBody.of('Done by hand.'),
      at: NOW,
      voice: Voice.station(RunId.of('run_1')),
    });

    await handOver(run(true), tasks(finished));

    expect(saved).toBeUndefined();
    expect(savedRun?.state).toBe('superseded');
  });

  it('leaves a run that succeeded as it was, even where its task moved on', async () => {
    await handOver(run(false), tasks(task('run_9')));

    expect(savedRun).toBeUndefined();
  });

  it('brings a stopped run back to the person rather than advancing it', async () => {
    await handOver(stoppedRun());

    expect(saved?.awaitingReview).toBe(true);
    expect(saved?.currentRunId).toBeNull();
    expect(saved?.notes[0]?.body.value).toContain(
      'A person stopped the run. The task is back with you.',
    );
  });

  it('closes a task that the run handed over as done', async () => {
    await handOver(
      run(
        false,
        HandoverReport.of({
          handover: Handover.of({
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
    await handOver(exhausted());

    expect(saved?.awaitingReview).toBe(true);
    expect(saved?.notes[0]?.body.value).toContain('3 attempts');
    expect(saved?.notes[0]?.failure?.code).toBe('runner-lost');
  });

  it('names the run’s last failure when it used all its attempts after timing out', async () => {
    await handOver(timedOut());

    expect(saved?.notes[0]?.body.value).toContain('3 attempts');
    expect(saved?.notes[0]?.failure?.code).toBe('timed-out');
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

  describe('a run that ends while its task waits on a person', () => {
    const asked = () =>
      task().putToAPerson(RunId.of('run_1'), {
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
        voice: Voice.station(RunId.of('run_1')),
      });

    it('releases the task, still asked, when the waiting run is stopped', async () => {
      await handOver(stoppedRun(), tasks(asked()));

      expect(saved?.currentRunId).toBeNull();
      expect(saved?.awaitingReview).toBe(true);
      expect(saved?.notes).toHaveLength(1);
    });

    it('never finishes or passes on a task whose question is still open', async () => {
      await handOver(
        run(
          false,
          HandoverReport.of({
            handover: Handover.of({ next: 'done', note: 'Done.' }),
          }),
        ),
        tasks(asked()),
      );

      expect(saved?.finished).toBe(false);
      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.currentRunId).toBeNull();
      expect(saved?.awaitingReview).toBe(true);
    });

    const deferredWhileAsked = () =>
      asked().deferMove(line(), StationId.of('station_4'), {
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('The checks failed on the pull request.'),
        at: NOW,
        voice: Voice.world(),
      });

    it.each([
      ['is stopped', stoppedRun],
      [
        'hands over the task as done',
        () =>
          run(
            false,
            HandoverReport.of({
              handover: Handover.of({ next: 'done', note: 'Done.' }),
            }),
          ),
      ],
      ['fails', () => run(true)],
    ])(
      'moves the task where a move was deferred to while it waited, when the waiting run %s',
      async (_, ending) => {
        await handOver(ending(), tasks(deferredWhileAsked()));

        expect(saved?.stationId).toEqual(StationId.of('station_4'));
        expect(saved?.awaitingReview).toBe(false);
        expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
        expect(saved?.notes[2]?.body.value).toMatch(
          /^Moved to Build when the run ended\. An event arrived while the run worked\./,
        );
      },
    );

    it('adds a failure to the open question, and detaches the task from its run', async () => {
      await handOver(run(true), tasks(asked()));

      expect(saved?.currentRunId).toBeNull();
      expect(saved?.notes[1]?.form).toBe('failure');
    });
  });

  describe('a move deferred while the run worked', () => {
    const deferred = (to = 'station_4') =>
      task().deferMove(line(), StationId.of(to), {
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('The checks failed on the pull request.'),
        at: NOW,
        voice: Voice.world(),
      });

    const handingOver = (next: string) =>
      run(
        false,
        HandoverReport.of({
          handover: Handover.of({ next, note: 'Over to you.' }),
        }),
      );

    const endings: readonly [string, () => Run, string][] = [
      ['hands over nothing', () => run(false), 'words'],
      ['asks a person', () => handingOver('review'), 'words'],
      ['hands over the task as done', () => handingOver('done'), 'words'],
      ['fails', () => run(true), 'failure'],
      ['is stopped', stoppedRun, 'words'],
      ['is never finished', exhausted, 'failure'],
    ];

    const MOVED =
      'Moved to Build when the run ended. An event arrived while the run worked.';

    it.each(endings)(
      'moves the task where it was deferred to when the run %s',
      async (_, ending, form) => {
        await handOver(ending(), tasks(deferred()));

        expect(saved?.stationId).toEqual(StationId.of('station_4'));
        expect(saved?.awaitingReview).toBe(false);
        expect(saved?.finished).toBe(false);
        expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
        expect(saved?.notes.map((each) => [each.kind, each.form])).toEqual([
          ['message', 'words'],
          ['passed', form],
        ]);
        expect(saved?.notes[1]?.body.value).toMatch(new RegExp(`^${MOVED}`));
        expect(saved?.deferredMoveTo).toBeNull();
      },
    );

    it.each(endings)(
      'leaves the task where it is when the run %s with nothing deferred',
      async (_, ending) => {
        await handOver(ending());

        expect(saved?.stationId).toEqual(StationId.of('station_1'));
        expect(saved?.currentRunId).toBeNull();
      },
    );

    const approvedMidRun = () => {
      const asked = deferred().clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
        ),
        ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
        {
          station: StationName.of('Triage'),
          body: TaskNoteBody.of('Approve linear.comment?'),
          at: NOW,
          voice: Voice.station(RunId.of('run_1')),
        },
        RunId.of('run_1'),
        null,
      ).task;

      return asked.answer(
        NotePosition.of(1),
        {
          station: StationName.of('Triage'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        },
        'granted',
      );
    };

    it.each([
      ['hands over the task as done', () => handingOver('done')],
      ['asks a person', () => handingOver('review')],
    ])(
      'moves the task where it was deferred to across a tool approval granted mid-run, when the run %s',
      async (_, ending) => {
        await handOver(ending(), tasks(approvedMidRun()));

        expect(saved?.stationId).toEqual(StationId.of('station_4'));
        expect(saved?.awaitingReview).toBe(false);
        expect(saved?.notes[3]?.body.value).toMatch(new RegExp(`^${MOVED}`));
      },
    );

    it('drops the deferred move when the run passes the task on', async () => {
      await handOver(handingOver('spec'), tasks(deferred()));

      expect(saved?.stationId).toEqual(StationId.of('station_2'));
      expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
      expect(saved?.deferredMoveTo).toBeNull();
    });

    it('passes the task on as before with nothing deferred', async () => {
      await handOver(handingOver('spec'));

      expect(saved?.stationId).toEqual(StationId.of('station_2'));
      expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
    });

    it('keeps the run’s own words on the task when a deferred move takes it on', async () => {
      await handOver(handingOver('review'), tasks(deferred()));

      expect(saved?.notes[1]?.body.value).toBe(`${MOVED}\n\nOver to you.`);
      expect(saved?.notes[1]?.voice.run).toEqual(RunId.of('run_1'));
    });

    it('tells nobody it is back with them when a deferred move takes a stopped run’s task on', async () => {
      await handOver(stoppedRun(), tasks(deferred()));

      expect(saved?.notes[1]?.body.value).toBe(
        `${MOVED}\n\nA person stopped the run.`,
      );
    });

    it('keeps a failed run’s failure where a deferred move takes its task on', async () => {
      await handOver(run(true), tasks(deferred()));

      expect(saved?.notes[1]?.failure).toMatchObject({
        source: 'run',
        code: 'exited',
      });
      expect(saved?.notes[1]?.body.value).toContain('The run failed');
    });

    it.each(endings)(
      'ends as the run handed over where the station deferred to has left the line, when the run %s',
      async (_, ending) => {
        await handOver(ending(), tasks(deferred('station_gone')));

        expect(saved?.stationId).toEqual(StationId.of('station_1'));
        expect(saved?.currentRunId).toBeNull();
        expect(saved?.notes[1]?.kind).not.toBe('message');
      },
    );

    it('finishes the task that the run handed over as done where the station deferred to has left the line', async () => {
      await handOver(handingOver('done'), tasks(deferred('station_gone')));

      expect(saved?.finished).toBe(true);
      expect(saved?.notes[1]?.body.value).toBe('Over to you.');
    });
  });
});
