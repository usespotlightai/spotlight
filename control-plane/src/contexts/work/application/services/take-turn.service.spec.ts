import { cannedJournalReadings as runJournalReadings } from '@work/application/ports/runs.fake-spec';
import type { TurnFacts } from '@runs/application/ports/run-turns.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  BeforeHookEvent,
  HookDecision,
} from '@work/application/ports/lifecycle-hooks.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { heldTurn, turnFacts } from '@work/application/ports/runs.fake-spec';
import type {
  TaskViewDto,
  TaskViewsPort,
} from '@work/application/ports/task-views.port';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import { RunRouting } from '@work/application/services/run-routing.service';
import { TakeTurn } from '@work/application/services/take-turn.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import {
  lineMapOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const TASK_VIEW = { taskId: 'task_1', runId: 'run_1' } as TaskViewDto;

const line = () =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      stationOf({
        id: StationId.of('station_0'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_1'),
        key: StationKey.of('build'),
        name: StationName.of('Build'),
        position: 1,
        color: '#a3a8b0',
        harness: HarnessId.of('dev'),
        routes: routesOf({ stations: [StationId.of('station_2')] }),
      }),
      stationOf({
        id: StationId.of('station_2'),
        key: StationKey.of('deploy'),
        name: StationName.of('Deploy'),
        position: 2,
        color: '#a3a8b0',
        harness: HarnessId.of('dev'),
      }),
      stationOf({
        id: StationId.of('station_3'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 3,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

const claimedByTheRun = () =>
  Task.add({
    line: line(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).assignRun(RunId.of('run_1'), line());

const attaching = () => {
  const asked: [string, readonly string[]][] = [];
  const taken: [string, readonly string[]][] = [];

  return {
    asked,
    taken,
    uploadedBy: async (
      run: RunId,
      workspaceId: WorkspaceId,
      ids: readonly string[],
    ) => {
      asked.push([`${run.value}@${workspaceId.value}`, ids]);
      return ids.map((id) =>
        Attachment.of({
          id,
          name: `${id.replace('file_', '')}.png`,
          contentType: 'image/png',
          size: 3,
        }),
      );
    },
    takenIn: async (workspaceId: WorkspaceId, files: readonly Attachment[]) =>
      void taken.push([workspaceId.value, files.map((each) => each.id.value)]),
  } as unknown as FilesLoader & {
    asked: [string, readonly string[]][];
    taken: [string, readonly string[]][];
  };
};

const RUN = RunId.of('run_1');

const dispatched = () =>
  Dispatch.ordered({
    id: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    subject: {
      kind: 'task',
      taskId: TaskId.of('task_1'),
      revision: TaskRevision.of(0),
      stationId: StationId.of('station_1'),
    },
    configuredAs: null,
    order: runOrderOf(RUN),
    now: NOW,
  }).enqueuedAsRun();

interface Turning {
  readonly decision?: HookDecision;
  readonly task?: Task | (() => Task | null) | null;
  readonly lastWords?: string;
  readonly files?: FilesLoader;
}

const turning = (over: Turning = {}) => {
  const held = heldTurn(null);
  const tasks: Task[] = [];
  const hookCalls: BeforeHookEvent[] = [];
  const clock = { now: () => NOW, sleep: async () => {} };
  const files =
    over.files ??
    ({
      uploadedBy: async () => [],
      takenIn: async () => {},
    } as unknown as FilesLoader);
  const taskOf = () =>
    typeof over.task === 'function' ? over.task() : (over.task ?? null);
  const taskStore = {
    find: async () => tasks[tasks.length - 1] ?? taskOf(),
    save: async (each: Task) => {
      tasks.push(each);
    },
  } as unknown as TaskRepository;
  const dispatches: DispatchRepository = {
    find: async () => dispatched(),
    add: async () => undefined,
    save: async () => undefined,
  };
  const taking = new TakeTurn(
    held.turns,
    held.runs,
    dispatches,
    taskStore,
    { findByStation: async () => line() } as unknown as LineMapsPort,
    {
      attemptsOfRun: async () => [],
    } as unknown as RunJournalReaderPort,
    { of: async () => TASK_VIEW } as unknown as TaskViewsPort,
    {
      listens: async () => true,
      before: async (_task, event) => {
        hookCalls.push(event);
        return over.decision ?? { kind: 'allowed' };
      },
      after: async () => {},
    },
    files,
    new RunRouting(
      { placementsAt: async () => [] } as never,
      { runIdFor: async () => RunId.of('run_2') },
      clock,
    ),
    runJournalReadings({ lastWordsIn: () => over.lastWords ?? null }),
  );

  return {
    tasks,
    hookCalls,
    taking,
    runs: held.runs,
    current: held.current,
    async take(facts: TurnFacts): Promise<void> {
      held.hold(facts);
      await taking.take(RUN, facts.attempt);
    },
  };
};

describe('TakeTurn', () => {
  const handingOver = (
    next: string,
    note = 'Ready for review.',
    files: NonNullable<TurnFacts['handover']>['files'] = [],
  ) => turnFacts({ handover: { next, note, files }, session: 'session_1' });

  const reviewing = handingOver('review', 'Which queue should I drain?');

  describe('a turn that asks a person', () => {
    it('keeps the turn, and puts the task to the person with the run’s note, session and turn', async () => {
      const turn = turning({ task: claimedByTheRun() });

      await turn.take(reviewing);

      const task = turn.tasks[0];
      expect(turn.runs.keep).toHaveBeenCalledWith(RUN, 1);
      expect(task?.awaitingReview).toBe(true);
      expect(task?.hasCurrentRun(RUN)).toBe(true);
      expect(task?.session?.value).toBe('session_1');
      expect(task?.awaitedTurn?.attempt).toBe(1);
      expect(task?.notes[0]?.body.value).toBe('Which queue should I drain?');
    });

    it('takes the files the run handed over only now, and attaches them to the note', async () => {
      const files = attaching();
      const turn = turning({ task: claimedByTheRun(), files });

      await turn.take(
        handingOver(
          'review',
          'Here is the selector.',
          ['light', 'dark'].map((name) => ({
            id: `file_${name}`,
            name: `${name}.png`,
            contentType: 'image/png',
            size: 3,
          })),
        ),
      );

      expect(files.taken).toEqual([['ws_1', ['file_light', 'file_dark']]]);
      expect(
        turn.tasks[0]?.notes[0]?.attachments.map((each) => each.name),
      ).toEqual(['light.png', 'dark.png']);
    });

    it('puts the last words of the latest attempt to the person when the turn names no next step', async () => {
      const turn = turning({
        task: claimedByTheRun(),
        lastWords: 'Here is a draft you can use.',
      });

      await turn.take(turnFacts({ session: 'session_1' }));

      expect(turn.tasks[0]?.notes[0]?.body.value).toBe(
        'Here is a draft you can use.',
      );
    });

    it('resumes the run at once, asking nothing, when messages came in during the turn (R1)', async () => {
      const answeredAlready = claimedByTheRun()
        .putToAPerson(RUN, {
          line: null,
          body: TaskNoteBody.of('Approve?'),
          at: NOW,
          voice: Voice.station(RUN),
        })
        .answer(NotePosition.of(0), {
          line: null,
          body: TaskNoteBody.of('Yes.'),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        });
      const turn = turning({ task: answeredAlready });

      await turn.take(reviewing);

      expect(turn.runs.resume).toHaveBeenCalledWith(
        RUN,
        1,
        'messages',
        expect.any(Array),
      );
      expect(turn.tasks).toEqual([]);
    });

    it('decides a redelivered turn once: the task is asked once and the turn stays kept (R5, R6)', async () => {
      const turn = turning({ task: claimedByTheRun() });

      await turn.take(reviewing);
      await turn.taking.take(RUN, 1);

      expect(turn.tasks).toHaveLength(1);
      expect(turn.runs.keep.mock.calls).toEqual([
        [RUN, 1],
        [RUN, 1],
      ]);
      expect(turn.current()?.turn).toBe('kept');
    });

    it('keeps the turn on redelivery after the task was saved but before the run was kept (R6)', async () => {
      const asked = claimedByTheRun().awaitTurn({
        turn: AwaitedTurn.of(RUN, 1),
        note: {
          line: null,
          body: TaskNoteBody.of('Which queue?'),
          at: NOW,
          voice: Voice.station(RUN),
        },
        session: null,
        runner: null,
      });
      const turn = turning({ task: asked });

      await turn.take(reviewing);

      expect(turn.tasks).toEqual([]);
      expect(turn.runs.keep).toHaveBeenCalledWith(RUN, 1);
    });

    it('decides nothing for a turn of an earlier attempt (R8)', async () => {
      const turn = turning({ task: claimedByTheRun() });

      await turn.take(reviewing);
      await turn.taking.take(RUN, 7);

      expect(turn.tasks).toHaveLength(1);
    });
  });

  it('routes the task and finishes the run when the turn passes the task to a station', async () => {
    const turn = turning({ task: claimedByTheRun() });

    await turn.take(handingOver('deploy', 'Built.'));

    expect(turn.runs.finish).toHaveBeenCalledWith(RUN, 1);
    expect(turn.tasks[0]?.stationId.value).toBe('station_2');
    expect(turn.tasks[0]?.currentRunId?.value).toBe('run_2');
  });

  it('routes a hand-over that a stop came in during, rather than asking (R4)', async () => {
    const stopping = turning({ task: claimedByTheRun() });

    await stopping.take(turnFacts({ stopRequested: true }));

    expect(stopping.runs.finish).toHaveBeenCalledWith(RUN, 1);
    expect(stopping.tasks[0]?.awaitingReview).toBe(true);
    expect(stopping.tasks[0]?.currentRunId).toBeNull();
  });

  it('finishes the run, recording nothing on the task, when its task let go of it (R3, R9)', async () => {
    const turn = turning({ task: null });

    await turn.take(reviewing);

    expect(turn.runs.finish).toHaveBeenCalledWith(RUN, 1);
    expect(turn.tasks).toEqual([]);
    expect(turn.hookCalls).toEqual([]);
  });

  describe('handing over', () => {
    it('calls the hooks before the task is handed over, saying where and what', async () => {
      const turn = turning({ task: claimedByTheRun() });

      await turn.take(handingOver('deploy'));

      expect(turn.hookCalls).toEqual([
        { on: 'handover.submitting', to: 'deploy', note: 'Ready for review.' },
      ]);
    });

    it('says nowhere where the run named no station', async () => {
      const turn = turning({ task: claimedByTheRun() });

      await turn.take(handingOver(''));

      expect(turn.hookCalls[0]).toMatchObject({ to: null });
    });

    it('puts the task to a person with the hook’s reason when a hook denies it', async () => {
      const turn = turning({
        task: claimedByTheRun(),
        decision: {
          kind: 'denied',
          reason: 'The hook core/qa denied the handover: tests are red.',
        },
      });

      await turn.take(handingOver('deploy'));

      expect(turn.tasks[0]?.awaitingReview).toBe(true);
      expect(turn.tasks[0]?.notes[0]?.body.value).toContain(
        'The hook core/qa denied the handover: tests are red.',
      );
      expect(turn.runs.keep).toHaveBeenCalledWith(RUN, 1);
    });

    it('calls no hooks when the run failed, was stopped or handed over nothing', async () => {
      const failed = turning({ task: claimedByTheRun() });
      await failed.take(
        turnFacts({
          outcome: {
            exitCode: 1,
            failure: 'exited',
            message: 'boom',
            stopped: false,
          },
        }),
      );
      const stopped = turning({ task: claimedByTheRun() });
      await stopped.take(
        turnFacts({
          outcome: {
            exitCode: 130,
            failure: null,
            message: null,
            stopped: true,
          },
        }),
      );
      const silent = turning({ task: claimedByTheRun() });
      await silent.take(turnFacts());

      expect(failed.hookCalls).toEqual([]);
      expect(stopped.hookCalls).toEqual([]);
      expect(silent.hookCalls).toEqual([]);
    });
  });

  it('refuses a task that holds the run at a revision it has since moved on from', async () => {
    const moved = Task.rehydrate({
      ...claimedByTheRun(),
      revision: TaskRevision.of(3),
    });
    const turn = turning({ task: moved });

    await expect(turn.take(reviewing)).rejects.toThrow(InconsistentStateError);
  });
});
