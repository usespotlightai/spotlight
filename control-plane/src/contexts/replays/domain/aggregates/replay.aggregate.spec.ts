import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayJudgingWanted } from '@replays/domain/events/replay-judging-wanted.event';
import { ReplayOverBudget } from '@replays/domain/events/replay-over-budget.event';
import { ReplayStarted } from '@replays/domain/events/replay-started.event';
import { ReplayStopAsked } from '@replays/domain/events/replay-stop-asked.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import { InvalidSpendError } from '@replays/domain/exceptions/invalid-spend.error';
import { ReplayEndedError } from '@replays/domain/exceptions/replay-ended.error';
import { ReplaySetStationGoneError } from '@replays/domain/exceptions/replay-set-station-gone.error';
import {
  aReplay,
  aSet,
  BY,
  candidateOf,
  endOf,
  FINGERPRINT,
  later,
  measuresOf,
  NOW,
  RUBRIC,
  runIds,
  STATION,
  settledAs,
} from '@replays/domain/replays.fake-spec';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { MOST_QUEUE_ATTEMPTS } from '@replays/domain/value-objects/replay-entry.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { ReplayStartDetail } from '@replays/domain/value-objects/replay-start-detail.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const run = (at: number) => RunId.of(`replay_run_${at}`);

const SEARCH = SearchId.of('search_1');

const reserved = (replay: Replay, room: number): Replay =>
  replay.reserving(room, runIds());

const stopAsked = (replay: Replay) =>
  new ReplayStopAsked(
    replay.id,
    replay.teamId,
    ConfigurationChange.updated(
      { resource: 'replay', id: replay.id.value, key: replay.id.value },
      BY,
    ),
  );

describe('Replay', () => {
  describe('starting', () => {
    it('is queued with one waiting entry per run of its set, in order', () => {
      const replay = aReplay({ count: 3 });

      expect(replay.current).toBe('queued');
      expect(replay.entries.map((each) => each.original.value)).toEqual([
        'original_0',
        'original_1',
        'original_2',
      ]);
      expect(replay.entries.every((each) => each.isWaiting)).toBe(true);
      expect(replay.isUnderway).toBe(true);
    });

    it('replays each run as many times as asked, every first copy before any second, each at a place of its own', () => {
      const replay = aReplay({ count: 2, repeats: 3 });

      expect(replay.repeats).toBe(3);
      expect(
        replay.entries.map((each) => [
          each.position,
          each.original.value,
          each.repeat,
        ]),
      ).toEqual([
        [0, 'original_0', 1],
        [1, 'original_1', 1],
        [2, 'original_0', 2],
        [3, 'original_1', 2],
        [4, 'original_0', 3],
        [5, 'original_1', 3],
      ]);
      expect(replay.originals.map((each) => each.value)).toEqual([
        'original_0',
        'original_1',
      ]);
      expect(aReplay().repeats).toBe(1);
    });

    it('replays each run from 1 to 5 times', () => {
      expect(() => aReplay({ repeats: 0 })).toThrow(InvalidReplayError);
      expect(() => aReplay({ repeats: 6 })).toThrow(InvalidReplayError);
      expect(() => aReplay({ repeats: 1.5 })).toThrow(InvalidReplayError);
      expect(aReplay({ repeats: 5 }).entries).toHaveLength(15);
    });

    it('replays at least one run', () => {
      expect(() => aReplay({ count: 0 })).toThrow(InvalidReplayError);
    });

    it('is a baseline only of the live config', () => {
      expect(() =>
        aReplay({ candidate: candidateOf('proposed'), baseline: true }),
      ).toThrow(InvalidReplayError);
      expect(
        aReplay({ candidate: candidateOf('live'), baseline: true }).baseline,
      ).toBe(true);
    });

    it('replays a candidate only at the set’s station', () => {
      const elsewhere = { ...STATION, stationId: 'station_ship' };
      const set = ReplaySet.opened({
        id: ReplaySetId.of('set_2'),
        station: elsewhere,
        name: ReplaySetName.of('Ship'),
        at: NOW,
      }).withEntry(
        {
          runId: RunId.of('original_0'),
          taskId: TaskId.of('task_0'),
          stationId: 'station_ship',
          refusal: null,
          reason: null,
        },
        NOW,
        false,
      );

      expect(() =>
        Replay.started({
          id: ReplayId.of('replay_1'),
          set,
          candidate: candidateOf('proposed'),
          baseline: false,
          ceiling: Spend.ceiling(1, 'USD'),
          at: NOW,
          by: BY,
        }),
      ).toThrow(InvalidReplayError);
    });

    it('starts nothing of a set whose station is gone', () => {
      expect(() =>
        Replay.started({
          id: ReplayId.of('replay_1'),
          set: aSet(1).stationLeft(NOW),
          candidate: candidateOf('proposed'),
          baseline: false,
          ceiling: Spend.ceiling(1, 'USD'),
          at: NOW,
          by: BY,
        }),
      ).toThrow(ReplaySetStationGoneError);
    });

    it('is capped at more than nothing and at most a thousand', () => {
      expect(() => Spend.ceiling(0, 'USD')).toThrow(InvalidSpendError);
      expect(() => Spend.ceiling(1_001, 'USD')).toThrow('at most 1,000');
      expect(() => Spend.ceiling(5, 'dollars')).toThrow(InvalidSpendError);
      expect(Spend.ceiling(5, 'usd').currency).toBe('USD');
    });

    it('adds spend up exactly, so a ceiling is reached on the very amount', () => {
      const spent = Spend.of(0.1, 'USD').plus(Spend.of(0.2, 'USD'));

      expect(spent.amount).toBe(0.3);
      expect(spent.reaches(Spend.ceiling(0.3, 'USD'))).toBe(true);
    });
  });

  describe('dispatching', () => {
    it('gives runs to as many waiting entries as there is room for, in order, and is then running', () => {
      const replay = reserved(aReplay({ count: 3 }), 2);

      expect(replay.current).toBe('running');
      expect(replay.entries.map((each) => each.run?.value ?? null)).toEqual([
        'replay_run_0',
        'replay_run_1',
        null,
      ]);
      expect(replay.occupying).toHaveLength(2);
      expect(replay.unconfirmed).toHaveLength(2);
    });

    it('gives out nothing without room', () => {
      const replay = aReplay();

      expect(replay.reserving(0, runIds())).toBe(replay);
    });

    it('takes a run as queued once Work queued it', () => {
      const replay = reserved(aReplay(), 1).confirmed(run(0), FINGERPRINT, NOW);

      expect(replay.unconfirmed).toEqual([]);
      expect(replay.occupying).toHaveLength(1);
    });

    it('settles an entry Work refused to queue, saying why', () => {
      const replay = reserved(aReplay({ count: 2 }), 1).refused(
        run(0),
        'archive-gone',
        NOW,
      );

      expect(replay.entries[0]?.ending).toBe('unreplayable');
      expect(replay.entries[0]?.refusal).toBe('archive-gone');
      expect(replay.occupying).toEqual([]);
    });

    it('ignores word of a run it never gave out', () => {
      const replay = aReplay();

      expect(replay.ended(RunId.of('elsewhere'), endOf('completed'))).toBe(
        replay,
      );
    });
  });

  describe('wanting a baseline', () => {
    it('says it wants one under a reserved id, against the live config, with its own ceiling', () => {
      const replay = Replay.started({
        id: ReplayId.of('replay_1'),
        set: aSet(1),
        candidate: candidateOf('proposed'),
        baseline: false,
        ceiling: Spend.ceiling(3, 'USD'),
        at: NOW,
        by: BY,
        wanting: {
          id: ReplayId.of('replay_2'),
          candidate: candidateOf('live'),
        },
      });

      expect(replay.pullEvents()).toEqual([
        new ReplayStarted(
          replay.id,
          replay.teamId,
          ConfigurationChange.created(
            { resource: 'replay', id: 'replay_1', key: 'replay_1' },
            BY,
            ReplayStartDetail.of({
              setId: replay.setId,
              candidateId: candidateOf('proposed').id,
              baseline: false,
              ceiling: Spend.ceiling(3, 'USD'),
              repeats: 1,
            }),
          ),
        ),
        new ReplayBaselineWanted(
          replay.id,
          replay.workspaceId,
          replay.setId,
          ReplayId.of('replay_2'),
          candidateOf('live').id,
          Spend.ceiling(3, 'USD'),
          null,
          1,
        ),
      ]);
    });

    it('wants no baseline of a proposed candidate, nor when it is the baseline', () => {
      for (const [baseline, wanted] of [
        [false, candidateOf('proposed')],
        [true, candidateOf('live')],
      ] as const) {
        expect(() =>
          Replay.started({
            id: ReplayId.of('replay_1'),
            set: aSet(1),
            candidate: candidateOf('live'),
            baseline,
            ceiling: Spend.ceiling(3, 'USD'),
            at: NOW,
            by: BY,
            wanting: { id: ReplayId.of('replay_2'), candidate: wanted },
          }),
        ).toThrow(InvalidReplayError);
      }
    });
  });

  describe('abandoning', () => {
    it('lets go of its runs in flight unless it was stopped already', () => {
      const underway = reserved(aReplay({ count: 2 }), 1);
      const abandoned = underway.abandoned();

      expect(abandoned.isAbandoned).toBe(true);
      expect(abandoned.pullEvents()).toEqual([
        new ReplayStopped(underway.id, underway.workspaceId, [run(0)]),
        new ReplayEnded(underway.id, underway.workspaceId, null, 'abandoned'),
      ]);

      const stopped = underway.stopped(NOW, BY);
      stopped.pullEvents();
      expect(stopped.abandoned().pullEvents()).toEqual([]);
    });
  });

  describe('queueing', () => {
    it('records the fingerprint its run was queued under', () => {
      const replay = reserved(aReplay(), 1).confirmed(run(0), FINGERPRINT, NOW);

      expect(replay.entries[0]?.fingerprint).toBe(FINGERPRINT);
    });

    it(`gives up on a run Work failed to queue ${MOST_QUEUE_ATTEMPTS} times only when told to, then freeing its slot`, () => {
      let replay = reserved(aReplay({ count: 2 }), 1);

      for (let at = 1; at < MOST_QUEUE_ATTEMPTS; at += 1) {
        replay = replay.queueFailed(run(0), NOW);
      }
      expect(replay.entries[0]?.queueAttempts).toBe(MOST_QUEUE_ATTEMPTS - 1);
      expect(replay.occupying).toHaveLength(1);

      replay = replay.queueFailed(run(0), NOW);
      expect(replay.entries[0]?.isGivenUp).toBe(true);
      expect(replay.occupying).toHaveLength(1);

      replay = replay.gaveUp(run(0), NOW);
      expect(replay.entries[0]?.refusal).toBe('dispatch-failed');
      expect(replay.occupying).toEqual([]);
    });
  });

  describe('results', () => {
    it('settles an entry once its run ended and was digested, in either order', () => {
      const started = reserved(aReplay({ count: 2 }), 2);
      const endedFirst = started
        .ended(run(0), endOf('completed'))
        .measured(run(0), measuresOf(1), NOW);
      const digestedFirst = started
        .measured(run(0), measuresOf(1), NOW)
        .ended(run(0), endOf('completed'));

      for (const replay of [endedFirst, digestedFirst]) {
        expect(replay.entries[0]?.isSettled).toBe(true);
        expect(replay.entries[0]?.ending).toBe('completed');
        expect(replay.occupying).toHaveLength(1);
      }
      expect(
        started.ended(run(0), endOf('completed')).entries[0]?.isSettled,
      ).toBe(false);
    });

    it('settles a withdrawn run without awaiting a digest, as stopped', () => {
      const replay = reserved(aReplay({ count: 2 }), 1).ended(
        run(0),
        endOf('withdrawn'),
      );

      expect(replay.entries[0]?.isSettled).toBe(true);
      expect(replay.entries[0]?.ending).toBe('stopped');
    });

    it('tells a run that asked a person, or was stopped, from one that failed', () => {
      expect(endOf('completed', { asked: true }).ending).toBe('asked');
      expect(endOf('completed', { stopped: true }).ending).toBe('stopped');
      expect(endOf('failed').ending).toBe('failed');
      expect(endOf('abandoned').ending).toBe('failed');
    });

    it('finishes once every entry has a result', () => {
      let replay = reserved(aReplay({ count: 2 }), 2);

      replay = settledAs(replay, run(0), 'completed', 1);
      expect(replay.current).toBe('running');

      replay = settledAs(replay, run(1), 'failed', 1);
      expect(replay.current).toBe('finished');
      expect(replay.endedAt).not.toBeNull();
      expect(replay.isUnderway).toBe(false);
    });

    it('records each result once', () => {
      const replay = settledAs(reserved(aReplay(), 1), run(0), 'completed', 1);

      expect(replay.ended(run(0), endOf('failed'))).toBe(replay);
      expect(replay.measured(run(0), measuresOf(9), NOW)).toBe(replay);
    });
  });

  describe('its budget', () => {
    it('adds up what its runs cost in the ceiling’s currency only', () => {
      let replay = reserved(aReplay({ count: 3, ceiling: 100 }), 3);

      replay = replay
        .measured(run(0), measuresOf(1.5), NOW)
        .measured(run(1), measuresOf(2, 1, 1, 'EUR'), NOW)
        .measured(run(2), measuresOf(null), NOW);

      expect(replay.spent.equals(Spend.of(1.5, 'USD'))).toBe(true);
    });

    it('stops dispatching once it has spent its ceiling, letting go of the runs still queued, while those running finish', () => {
      let replay = reserved(aReplay({ count: 4, ceiling: 2 }), 2)
        .confirmed(run(0), FINGERPRINT, NOW)
        .confirmed(run(1), FINGERPRINT, NOW);

      replay = settledAs(replay, run(0), 'completed', 2.5);

      expect(replay.current).toBe('over-budget');
      expect(replay.entries.map((each) => each.ending)).toEqual([
        'completed',
        null,
        'not-run',
        'not-run',
      ]);
      expect(replay.reserving(2, runIds())).toBe(replay);
      expect(replay.pullEvents()).toEqual([
        new ReplayOverBudget(replay.id, replay.workspaceId, [run(1)]),
        new ReplayEnded(replay.id, replay.workspaceId, null, 'over-budget'),
      ]);
      expect(replay.isUnderway).toBe(true);

      replay = settledAs(replay, run(1), 'completed', 1);
      expect(replay.current).toBe('over-budget');
      expect(replay.isUnderway).toBe(false);
    });
  });

  describe('stopping', () => {
    it('runs nothing more, and asks for its runs in flight to be stopped', () => {
      const replay = reserved(aReplay({ count: 3 }), 2)
        .confirmed(run(0), FINGERPRINT, NOW)
        .stopped(later(1), BY);

      expect(replay.current).toBe('stopped');
      expect(replay.entries.map((each) => each.ending)).toEqual([
        null,
        null,
        'not-run',
      ]);
      expect(replay.occupying).toHaveLength(2);
      expect(replay.forgone(run(1), NOW).occupying).toHaveLength(1);
      expect(replay.forgone(run(0), NOW).occupying).toHaveLength(2);
      expect(replay.pullEvents()).toEqual([
        new ReplayStopped(replay.id, replay.workspaceId, [run(0), run(1)]),
        new ReplayEnded(replay.id, replay.workspaceId, null, 'stopped'),
        stopAsked(replay),
      ]);
    });

    it('still records what its stopped runs did', () => {
      const replay = settledAs(
        reserved(aReplay({ count: 1 }), 1).stopped(later(1), BY),
        run(0),
        'completed',
        1,
      );

      expect(replay.current).toBe('stopped');
      expect(replay.entries[0]?.ending).toBe('completed');
    });

    it('cannot be stopped once it has ended', () => {
      const finished = settledAs(
        reserved(aReplay({ count: 1 }), 1),
        run(0),
        'completed',
        1,
      );

      expect(() => finished.stopped(NOW, BY)).toThrow(ReplayEndedError);
    });

    it('is stopped once, though its runs are still stopping', () => {
      const stopping = reserved(aReplay({ count: 1 }), 1)
        .confirmed(run(0), FINGERPRINT, NOW)
        .stopped(NOW, BY);

      expect(stopping.isUnderway).toBe(true);
      expect(() => stopping.stopped(NOW, BY)).toThrow(ReplayEndedError);
    });

    it('may be stopped while over budget, staying over budget and stopping the runs still running', () => {
      const over = settledAs(
        reserved(aReplay({ count: 3, ceiling: 1 }), 2).confirmed(
          run(1),
          FINGERPRINT,
          NOW,
        ),
        run(0),
        'completed',
        2,
      );
      over.pullEvents();

      const stopped = over.stopped(NOW, BY);

      expect(stopped.current).toBe('over-budget');
      expect(stopped.stoppedAt).toEqual(NOW);
      expect(() => stopped.stopped(NOW, BY)).toThrow(ReplayEndedError);
      expect(stopped.pullEvents()).toEqual([
        new ReplayStopped(stopped.id, stopped.workspaceId, [run(1)]),
        stopAsked(stopped),
      ]);
    });
  });

  describe('scoring', () => {
    const judging = () =>
      reserved(
        aReplay({
          count: 1,
          candidate: candidateOf('proposed', 'candidate_judged', RUBRIC),
        }),
        1,
      );
    const passed = ChangeChecks.of([
      {
        repository: 'api',
        state: 'passed',
        skip: null,
        failedAt: [],
        spent: ModelSpent.of([], 0),
      },
    ]);
    const drafting = ChangeChecks.of([
      {
        repository: 'api',
        state: 'drafting',
        skip: null,
        failedAt: [],
        spent: ModelSpent.of([], 0),
      },
    ]);
    const done = (replay: Replay) =>
      replay
        .confirmed(run(0), FINGERPRINT, NOW)
        .ended(run(0), endOf('completed'))
        .measured(run(0), measuresOf(1), later(61_000));

    it('does not finish while its checks are still to come', () => {
      const replay = done(reserved(aReplay({ count: 1 }), 1)).reviewed(
        run(0),
        drafting,
        null,
        later(62_000),
      );

      expect(replay.current).toBe('running');
      expect(replay.reviewed(run(0), passed, null, later(63_000)).current).toBe(
        'finished',
      );
    });

    it('asks its judge once its change stack is settled, once, then finishes on the verdict', () => {
      const drafted = done(judging()).reviewed(
        run(0),
        drafting,
        null,
        later(62_000),
      );
      drafted.pullEvents();

      expect(drafted.entries[0]?.judging).toBeNull();

      const settled = drafted.reviewed(run(0), passed, null, later(63_000));
      const wanted = settled.pullEvents();

      expect(wanted).toEqual([
        new ReplayJudgingWanted(
          settled.id,
          settled.workspaceId,
          settled.candidateId,
          run(0),
          RunId.of('original_0'),
        ),
      ]);
      expect(settled.current).toBe('running');
      expect(
        settled.reviewed(run(0), passed, null, later(64_000)).pullEvents(),
      ).toEqual([]);

      const judged = settled.judged(
        run(0),
        JudgeVerdict.of({
          scale: 'number',
          value: 5,
          model: 'judge/model',
          referenced: true,
          reasons: [],
        }),
        null,
        later(65_000),
      );

      expect(judged.current).toBe('finished');
      expect(judged.entries[0]?.succeeded).toBe(true);
    });

    it('finishes, unscored, when its judge could not judge, rather than waiting for ever', () => {
      const replay = done(judging())
        .reviewed(run(0), passed, null, later(62_000))
        .judgingFailed(run(0), 'interrupted', null, later(63_000));

      expect(replay.current).toBe('finished');
      expect(replay.entries[0]?.succeeded).toBeNull();
      expect(replay.entries[0]?.reasons.map((each) => each.code)).toEqual([
        'unjudged',
      ]);
    });

    it('leaves a run that left no change stack unscored where its candidate checks changes, and finishes', () => {
      const checking = reserved(
        aReplay({
          count: 1,
          candidate: candidateOf(
            'proposed',
            'candidate_checked',
            null,
            'npm test',
          ),
        }),
        1,
      );
      const replay = done(checking).reviewed(
        run(0),
        ChangeChecks.of([]),
        null,
        later(62_000),
      );

      expect(checking.checked).toBe(true);
      expect(replay.current).toBe('finished');
      expect(replay.entries[0]?.succeeded).toBeNull();
      expect(replay.entries[0]?.reasons.map((each) => each.code)).toEqual([
        'no-change-stack',
      ]);
    });

    it('asks no more judging once stopped, leaving such entries unscored', () => {
      const stopped = done(judging())
        .reviewed(run(0), drafting, null, later(62_000))
        .stopped(later(62_500), BY);
      stopped.pullEvents();

      const settled = stopped.reviewed(run(0), passed, null, later(63_000));

      expect(settled.pullEvents().map((each) => each.kind)).not.toContain(
        'replay.judging-wanted',
      );
      expect(settled.entries[0]?.judging?.unjudged).toBe(
        'stopped-before-judging',
      );
      expect(settled.entries[0]?.succeeded).toBeNull();
    });

    it('spends what drafting and judging its change cost against its ceiling', () => {
      const replay = done(judging())
        .reviewed(
          run(0),
          passed,
          ModelSpent.of([Spend.of(0.25, 'USD')], 0),
          later(62_000),
        )
        .judged(
          run(0),
          JudgeVerdict.of({
            scale: 'number',
            value: 5,
            model: 'judge/model',
            referenced: false,
            reasons: [],
          }),
          ModelSpent.of([Spend.of(0.5, 'USD')], 0),
          later(63_000),
        );

      expect(replay.spent.amount).toBeCloseTo(1.75);
    });

    it('goes over budget on what drafting and judging cost too', () => {
      const replay = reserved(
        aReplay({
          count: 2,
          ceiling: 1.5,
          candidate: candidateOf('proposed', 'candidate_judged', RUBRIC),
        }),
        1,
      )
        .confirmed(run(0), FINGERPRINT, NOW)
        .ended(run(0), endOf('completed'))
        .measured(run(0), measuresOf(1), later(61_000))
        .reviewed(
          run(0),
          passed,
          ModelSpent.of([Spend.of(0.6, 'USD')], 0),
          later(62_000),
        );

      expect(replay.current).toBe('over-budget');
    });

    it('asks no judge for a run that failed, which has failed already', () => {
      const replay = judging()
        .confirmed(run(0), FINGERPRINT, NOW)
        .ended(run(0), endOf('failed'))
        .reviewed(run(0), ChangeChecks.of([]), null, later(62_000))
        .measured(run(0), measuresOf(1), later(63_000));

      expect(replay.pullEvents().map((each) => each.kind)).not.toContain(
        'replay.judging-wanted',
      );
      expect(replay.current).toBe('finished');
      expect(replay.entries[0]?.succeeded).toBe(false);
    });
  });

  describe('saying it ended', () => {
    const endedEvents = (replay: Replay) =>
      replay.pullEvents().filter((each) => each instanceof ReplayEnded);

    it('says it finished once, for its search', () => {
      let replay = reserved(aReplay({ count: 2, searchId: SEARCH }), 2);

      replay = settledAs(replay, run(0), 'completed', 1);
      expect(endedEvents(replay)).toEqual([]);

      replay = settledAs(replay, run(1), 'completed', 1);
      expect(endedEvents(replay)).toEqual([
        new ReplayEnded(replay.id, replay.workspaceId, SEARCH, 'finished'),
      ]);
      expect(() => replay.stopped(NOW, BY)).toThrow(ReplayEndedError);
      expect(endedEvents(replay.abandoned())).toEqual([]);
    });

    it('says it went over budget once, and not again when stopped or abandoned after', () => {
      let replay = reserved(aReplay({ count: 3, ceiling: 1 }), 2).confirmed(
        run(1),
        FINGERPRINT,
        NOW,
      );

      replay = settledAs(replay, run(0), 'completed', 2);
      expect(endedEvents(replay)).toEqual([
        new ReplayEnded(replay.id, replay.workspaceId, null, 'over-budget'),
      ]);

      replay = settledAs(replay, run(1), 'completed', 1);
      expect(endedEvents(replay)).toEqual([]);
      expect(endedEvents(replay.abandoned())).toEqual([]);
    });

    it('says it was stopped once, though its stopped runs settle after', () => {
      let replay = reserved(aReplay({ count: 2 }), 1)
        .confirmed(run(0), FINGERPRINT, NOW)
        .stopped(NOW, BY);

      expect(endedEvents(replay)).toEqual([
        new ReplayEnded(replay.id, replay.workspaceId, null, 'stopped'),
      ]);

      replay = settledAs(replay, run(0), 'completed', 1);
      expect(endedEvents(replay)).toEqual([]);
      expect(endedEvents(replay.abandoned())).toEqual([]);
    });

    it('says it was abandoned when abandoned while dispatching', () => {
      const replay = aReplay();

      expect(endedEvents(replay.abandoned())).toEqual([
        new ReplayEnded(replay.id, replay.workspaceId, null, 'abandoned'),
      ]);
    });
  });

  describe('replaying some of its set', () => {
    it('replays only the runs it was given, in its set’s order', () => {
      const replay = aReplay({
        count: 5,
        among: [RunId.of('original_3'), RunId.of('original_1')],
        searchId: SEARCH,
      });

      expect(replay.originals.map((each) => each.value)).toEqual([
        'original_1',
        'original_3',
      ]);
      expect(replay.entries.map((each) => each.position)).toEqual([0, 1]);
      expect(replay.among?.map((each) => each.value)).toEqual([
        'original_3',
        'original_1',
      ]);
      expect(replay.searchId).toEqual(SEARCH);
    });

    it.each([
      ['none', []],
      ['one its set never held', ['original_0', 'elsewhere']],
      ['one twice', ['original_0', 'original_0']],
    ])('refuses to replay %s', (_, among) => {
      expect(() =>
        aReplay({ count: 3, among: among.map((each) => RunId.of(each)) }),
      ).toThrow(InvalidReplayError);
    });

    it('replays its whole set when it is or wants a baseline', () => {
      expect(() =>
        aReplay({
          count: 3,
          candidate: candidateOf('live'),
          baseline: true,
          among: [RunId.of('original_0')],
        }),
      ).toThrow(InvalidReplayError);
      expect(() =>
        Replay.started({
          id: ReplayId.of('replay_1'),
          set: aSet(3),
          candidate: candidateOf('proposed'),
          baseline: false,
          ceiling: Spend.ceiling(10, 'USD'),
          at: NOW,
          by: BY,
          wanting: {
            id: ReplayId.of('replay_baseline'),
            candidate: candidateOf('live'),
          },
          among: [RunId.of('original_0')],
        }),
      ).toThrow(InvalidReplayError);
    });

    it('adds up what only some of its runs spent', () => {
      let replay = reserved(aReplay({ count: 3, ceiling: 100 }), 3);

      replay = settledAs(replay, run(0), 'completed', 1);
      replay = settledAs(replay, run(1), 'completed', 2);

      expect(replay.spent.amount).toBe(3);
      expect(replay.spendAmong([RunId.of('original_1')]).spent.amount).toBe(2);
      expect(
        replay.spendAmong([RunId.of('original_0'), RunId.of('original_2')])
          .spent.amount,
      ).toBe(1);
    });
  });
});
