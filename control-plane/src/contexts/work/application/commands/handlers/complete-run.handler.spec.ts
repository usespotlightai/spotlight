import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CompleteRunHandler } from '@work/application/commands/handlers/complete-run.handler';
import { CompleteRunCommand } from '@work/application/commands/runner.commands';
import type {
  HookedTaskDto,
  HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import type {
  BeforeMoment,
  HookVerdict,
} from '@work/application/ports/lifecycle-hooks.port';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
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
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const held = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject: RunSubject.task(
      TaskId.of('task_1'),
      StationId.of('station_1'),
      TaskRevision.of(0),
    ),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station' },
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

const HOOKED = { taskId: 'task_1', runId: 'run_1' } as HookedTaskDto;

const line = () =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
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
        id: StationId.of('station_1'),
        key: StationKey.of('build'),
        name: StationName.of('Build'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        harness: HarnessId.of('dev'),
        wayOut: WayOut.of({ stations: [StationId.of('station_2')] }),
      }),
      Station.of({
        id: StationId.of('station_2'),
        key: StationKey.of('deploy'),
        name: StationName.of('Deploy'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        harness: HarnessId.of('dev'),
      }),
      Station.of({
        id: StationId.of('station_3'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 3,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const workedByTheRun = () =>
  Task.add({
    line: line(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).handedTo(RunId.of('run_1'), line());

const completing = (
  save: (run: Run) => Promise<void>,
  verdict: HookVerdict = { kind: 'allowed' },
  task: Task | (() => Task) | null = null,
  stored: { tasks: Task[]; run?: () => Run } = { tasks: [] },
) => {
  const asked: BeforeMoment[] = [];
  const handler = new CompleteRunHandler(
    {
      findById: async () => (stored.run ? stored.run() : held()),
      save,
    } as unknown as RunRepository,
    {
      find: async () => (typeof task === 'function' ? task() : task),
      save: async (each: Task) => void stored.tasks.push(each),
    } as unknown as TaskRepository,
    { holding: async () => line() } as unknown as LineRepository,
    {
      inTransaction: (work: () => Promise<unknown>) => work(),
    } as TransactionPort,
    { of: async () => HOOKED } as unknown as HookedTasksPort,
    {
      listens: async () => true,
      before: async (_task, moment) => {
        asked.push(moment);
        return verdict;
      },
      after: async () => {},
    },
    { now: () => NOW, sleep: async () => {} },
  );

  return Object.assign(handler, { asked });
};

const declaredOn = (run: Run | undefined) =>
  (
    run?.pullEvents().find((each) => each instanceof RunCompleted) as
      | RunCompleted
      | undefined
  )?.declared;

describe('CompleteRunHandler', () => {
  describe('ending a turn that asks a person', () => {
    const reviewing = new CompleteRunCommand(
      'run_1',
      'runner_1',
      0,
      false,
      undefined,
      { next: 'review', note: 'Which queue should I drain?' },
      'session_1',
      false,
      true,
    );

    it('pauses the run instead of ending it, and tells the runner to wait', async () => {
      const saved: Run[] = [];
      const stored = { tasks: [] as Task[] };

      const answered = await completing(
        async (run) => void saved.push(run),
        { kind: 'allowed' },
        workedByTheRun(),
        stored,
      ).execute(reviewing);

      expect(answered).toEqual({ waiting: true });
      expect(saved[0]?.state).toBe('waiting');
      expect(stored.tasks[0]?.awaitingReview).toBe(true);
      expect(stored.tasks[0]?.heldBy(RunId.of('run_1'))).toBe(true);
      expect(stored.tasks[0]?.sessionId?.value).toBe('session_1');
      expect(stored.tasks[0]?.notes[0]?.body.value).toBe(
        'Which queue should I drain?',
      );
      expect(saved[0]?.hasEnded).toBe(false);
      expect(
        saved[0]?.pullEvents().some((each) => each instanceof RunPaused),
      ).toBe(true);
    });

    it('keeps the session it paused in, so a later runner resumes it', async () => {
      const saved: Run[] = [];

      await completing(
        async (run) => void saved.push(run),
        { kind: 'allowed' },
        workedByTheRun(),
      ).execute(reviewing);

      expect(saved[0]?.spec.value.continuity).toEqual({
        key: 'task:station',
        sessionId: 'session_1',
        resumes: true,
      });
    });

    it('ends the run as before when the turn hands the task on to a station', async () => {
      const saved: Run[] = [];

      const answered = await completing(
        async (run) => void saved.push(run),
        { kind: 'allowed' },
        workedByTheRun(),
      ).execute(
        new CompleteRunCommand('run_1', 'runner_1', 0, false, undefined, {
          next: 'deploy',
        }),
      );

      expect(answered).toEqual({ waiting: false });
      expect(saved[0]?.state).toBe('completed');
    });

    it('ends a failed turn even where it would have asked a person', async () => {
      const saved: Run[] = [];

      const answered = await completing(
        async (run) => void saved.push(run),
        { kind: 'allowed' },
        workedByTheRun(),
      ).execute(
        new CompleteRunCommand('run_1', 'runner_1', 1, true, 'boom', {
          next: 'review',
        }),
      );

      expect(answered).toEqual({ waiting: false });
      expect(saved[0]?.state).toBe('failed');
    });

    it('carries on at once, without pausing or asking again, when the person already answered', async () => {
      const saved: Run[] = [];
      const stored = { tasks: [] as Task[] };
      const answeredAlready = workedByTheRun()
        .putToAPerson(RunId.of('run_1'), {
          station: StationName.of('Build'),
          body: TaskNoteBody.of('Approve?'),
          at: NOW,
          voice: Voice.station(RunId.of('run_1')),
        })
        .answer(NotePosition.of(0), {
          station: StationName.of('Build'),
          body: TaskNoteBody.of('Yes.'),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        });

      const answered = await completing(
        async (run) => void saved.push(run),
        { kind: 'allowed' },
        answeredAlready,
        stored,
      ).execute(reviewing);

      expect(answered).toEqual({ waiting: true });
      expect(saved).toEqual([]);
      expect(stored.tasks).toEqual([]);
    });

    it('answers a repeated report of a pause the same way, changing nothing and asking no hook again', async () => {
      const saved: Run[] = [];
      const waiting = () =>
        held().paused(
          RunnerId.of('runner_1'),
          RunOutcome.of({ exitCode: 0, failed: false }),
          HandoverReport.none(),
          NOW,
        );

      const handler = completing(
        async (run) => void saved.push(run),
        { kind: 'allowed' },
        workedByTheRun(),
        { tasks: [], run: waiting },
      );

      const answered = await handler.execute(reviewing);

      expect(answered).toEqual({ waiting: true });
      expect(saved).toEqual([]);
      expect(handler.asked).toEqual([]);
    });

    it('ends the run as before when the runner could not keep its workspace', async () => {
      const saved: Run[] = [];

      const answered = await completing(
        async (run) => void saved.push(run),
        { kind: 'allowed' },
        workedByTheRun(),
      ).execute(
        new CompleteRunCommand(
          'run_1',
          'runner_1',
          0,
          false,
          undefined,
          { next: 'review' },
          'session_1',
          false,
          false,
        ),
      );

      expect(answered).toEqual({ waiting: false });
      expect(saved[0]?.state).toBe('completed');
    });

    it('reads the task again when a person answered it while the turn was being reported', async () => {
      const saved: Run[] = [];
      let reads = 0;
      const asked = workedByTheRun().putToAPerson(RunId.of('run_1'), {
        station: StationName.of('Build'),
        body: TaskNoteBody.of('Approve?'),
        at: NOW,
        voice: Voice.station(RunId.of('run_1')),
      });
      const answeredMeanwhile = asked.answer(NotePosition.of(0), {
        station: StationName.of('Build'),
        body: TaskNoteBody.of('Yes.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_1')),
      });
      const stored = { tasks: [] as Task[] };
      const handler = completing(
        async (run) => void saved.push(run),
        { kind: 'allowed' },
        () => (reads++ === 0 ? asked : answeredMeanwhile),
        stored,
      );
      let conflicted = false;
      const saving = stored.tasks.push.bind(stored.tasks);
      stored.tasks.push = (...each: Task[]) => {
        if (!conflicted) {
          conflicted = true;
          throw new TaskVersionConflictError('task_1');
        }
        return saving(...each);
      };

      const answered = await handler.execute(reviewing);

      expect(answered).toEqual({ waiting: true });
      expect(reads).toBe(2);
      expect(saved).toEqual([]);
    });

    it('ends the run when its task has moved on without it', async () => {
      const saved: Run[] = [];

      const answered = await completing(
        async (run) => void saved.push(run),
      ).execute(reviewing);

      expect(answered).toEqual({ waiting: false });
      expect(saved[0]?.state).toBe('completed');
    });
  });

  it('keeps whether the run was stopped on what it ended with', async () => {
    const saved: Run[] = [];

    await completing(async (run) => void saved.push(run)).execute(
      new CompleteRunCommand(
        'run_1',
        'runner_1',
        130,
        false,
        undefined,
        null,
        null,
        true,
      ),
    );

    expect(saved[0]?.outcome?.stopped).toBe(true);
  });

  describe('a run its host stopped for running past its time', () => {
    const RUNNER = RunnerId.of('runner_1');
    const timedOut = new CompleteRunCommand(
      'run_1',
      'runner_1',
      -1,
      true,
      "Sandbox stopped at the host's time limit. Time limit: 2h0m0s",
      null,
      null,
      false,
      false,
      false,
      true,
    );
    const lastAttempt = () =>
      held()
        .timedOut(RUNNER, NOW)
        .claim(RUNNER, NOW)
        .timedOut(RUNNER, NOW)
        .claim(RUNNER, NOW);

    it('goes back on the queue, as a lapsed run does', async () => {
      const saved: Run[] = [];

      await completing(async (run) => void saved.push(run)).execute(timedOut);

      expect(saved[0]?.state).toBe('queued');
    });

    it('is given up on as timed out at its last attempt', async () => {
      const saved: Run[] = [];

      await completing(async (run) => void saved.push(run), undefined, null, {
        tasks: [],
        run: lastAttempt,
      }).execute(timedOut);

      expect(saved[0]?.outcome?.failure?.code).toBe('timed-out');
    });

    it('tries again when the run changed while it was told of its end, as by the lease its host was still renewing', async () => {
      const saved: Run[] = [];
      let tries = 0;

      await completing(async (run) => {
        tries += 1;
        if (tries === 1) {
          throw new RunVersionConflictError(run.id.value);
        }
        saved.push(run);
      }).execute(timedOut);

      expect(tries).toBe(2);
      expect(saved[0]?.state).toBe('queued');
    });
  });

  it('reports a run that changed while it was completing as a conflict', async () => {
    await expect(
      completing(async (run) => {
        throw new RunVersionConflictError(run.id.value);
      }).execute(new CompleteRunCommand('run_1', 'runner_1', 0, false)),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  describe('handing over', () => {
    const handingOver = (next: string) =>
      new CompleteRunCommand('run_1', 'runner_1', 0, false, undefined, {
        next,
        note: 'Ready for review.',
      });

    it('asks the hooks before the task is handed over, saying where and what', async () => {
      const saved: Run[] = [];
      const handler = completing(async (run) => void saved.push(run));

      await handler.execute(handingOver('review-code'));

      expect(handler.asked).toEqual([
        { on: 'handover.giving', to: 'review-code', note: 'Ready for review.' },
      ]);
      expect(declaredOn(saved[0])?.next).toBe('review-code');
    });

    it('says nowhere where the run named no station', async () => {
      const handler = completing(async () => {});

      await handler.execute(handingOver(''));

      expect(handler.asked[0]).toMatchObject({ to: null });
    });

    it('puts the task to a person with the hook’s reason when a hook refuses', async () => {
      const saved: Run[] = [];

      await completing(async (run) => void saved.push(run), {
        kind: 'refused',
        reason: 'The hook core/qa refused: tests are red.',
      }).execute(handingOver('deploy'));

      const declared = declaredOn(saved[0]);
      expect(declared?.asksForReview()).toBe(true);
      expect(declared?.note).toBe(
        'The hook core/qa refused: tests are red.\n\nThe run said: Ready for review.',
      );
    });

    it('asks no hooks when the run failed or was stopped', async () => {
      const failed = completing(async () => {});
      await failed.execute(
        new CompleteRunCommand('run_1', 'runner_1', 1, true, 'boom', {
          next: 'deploy',
        }),
      );

      const stopped = completing(async () => {});
      await stopped.execute(
        new CompleteRunCommand(
          'run_1',
          'runner_1',
          130,
          false,
          undefined,
          { next: 'deploy' },
          null,
          true,
        ),
      );

      expect(failed.asked).toEqual([]);
      expect(stopped.asked).toEqual([]);
    });

    it('asks no hooks when the run declared nothing', async () => {
      const handler = completing(async () => {});

      await handler.execute(
        new CompleteRunCommand('run_1', 'runner_1', 0, false),
      );

      expect(handler.asked).toEqual([]);
    });

    it('asks no hooks for a run another runner holds', async () => {
      const handler = completing(async () => {});

      await expect(
        handler.execute(
          new CompleteRunCommand('run_1', 'runner_2', 0, false, undefined, {
            next: 'deploy',
          }),
        ),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(handler.asked).toEqual([]);
    });
  });
});
