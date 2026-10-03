import { AbandonReplays } from '@replays/application/services/abandon-replays.service';
import { AskForReplayJudging } from '@replays/application/services/ask-for-replay-judging.service';
import { AskForReplayRecheck } from '@replays/application/services/ask-for-replay-recheck.service';
import { AskForReplayRejudging } from '@replays/application/services/ask-for-replay-rejudging.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { HoldSetStartingPoints } from '@replays/application/services/hold-set-starting-points.service';
import { LetReplayRunsGo } from '@replays/application/services/let-replay-runs-go.service';
import { NoteLineRedefined } from '@replays/application/services/note-line-redefined.service';
import { NoteReplayChangeReviewed } from '@replays/application/services/note-replay-change-reviewed.service';
import { NoteReplayDigested } from '@replays/application/services/note-replay-digested.service';
import { NoteReplayEnded } from '@replays/application/services/note-replay-ended.service';
import { NoteReplayJudged } from '@replays/application/services/note-replay-judged.service';
import {
  AT_HAND,
  CLOCK,
  FakeChangeReview,
  FakeOutcomes,
  FakeWork,
  IDS,
  InMemoryReplays,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { ReplayAbandonmentDue } from '@replays/domain/events/replay-abandonment-due.event';
import type { ReplayJudgingWanted } from '@replays/domain/events/replay-judging-wanted.event';
import { ReplayRecheckUnavailable } from '@replays/domain/events/replay-recheck-unavailable.event';
import type { ReplayRecheckWanted } from '@replays/domain/events/replay-recheck-wanted.event';
import { ReplayRejudgingRefused } from '@replays/domain/events/replay-rejudging-refused.event';
import type { ReplayRejudgingWanted } from '@replays/domain/events/replay-rejudging-wanted.event';
import { ReplaySetStationCheckDue } from '@replays/domain/events/replay-set-station-check-due.event';
import type { ReplayStackRecheckWanted } from '@replays/domain/events/replay-stack-recheck-wanted.event';
import {
  aBudget,
  aReplay,
  aSearch,
  aSet,
  BY,
  candidateOf,
  endOf,
  FINGERPRINT,
  later,
  measuresOf,
  NOW,
  RUBRIC,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { REPLAY_RUNS_AT_ONCE } from '@replays/domain/services/replay-dispatch';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { MOST_QUEUE_ATTEMPTS } from '@replays/domain/value-objects/replay-entry.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;

const LOGGER = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as never;

const dispatching = () =>
  new DispatchReplayRuns(
    memory.replayRepository,
    memory.candidateRepository,
    memory.searchRepository,
    work,
    IDS,
    CLOCK,
    TRANSACTION,
    LOGGER,
  );

beforeEach(async () => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  await memory.candidateRepository.add(candidateOf('proposed'));
});

describe('DispatchReplayRuns', () => {
  it('queues as many of a team’s replay runs as it allows at once, under each replay’s candidate', async () => {
    await memory.replayRepository.add(aReplay({ id: 'replay_a', count: 3 }));
    await memory.replayRepository.add(
      aReplay({ id: 'replay_b', count: 3, at: later(1) }),
    );

    await dispatching().workDue();

    expect(work.dispatched).toHaveLength(REPLAY_RUNS_AT_ONCE);
    expect(work.dispatched.map((each) => each.original.value)).toEqual([
      'original_0',
      'original_1',
    ]);
    expect(work.dispatched[0]?.block.key).toBe('build');
    expect(memory.replays.get('replay_a')?.unconfirmed).toEqual([]);
    expect(memory.replays.get('replay_b')?.current).toBe('queued');

    await dispatching().workDue();
    expect(work.dispatched).toHaveLength(REPLAY_RUNS_AT_ONCE);
  });

  it('settles an entry Work refuses to queue, and moves on to the next', async () => {
    await memory.replayRepository.add(aReplay({ count: 2 }));
    work.refusing = { queued: false, refusal: 'archive-gone' };

    await dispatching().workDue();

    expect(
      memory.replays.get('replay_1')?.entries.map((each) => each.refusal),
    ).toEqual(['archive-gone', 'archive-gone']);
    expect(memory.replays.get('replay_1')?.current).toBe('finished');
  });

  it('queues a search’s replay runs at the search’s own concurrency, only while the search is active', async () => {
    const search = aSearch({ budget: aBudget({ concurrency: 3 }) });

    await memory.searchRepository.add(search);
    await memory.replayRepository.add(aReplay({ id: 'replay_team', count: 4 }));
    await memory.replayRepository.add(
      aReplay({ id: 'replay_search', count: 5, searchId: search.id }),
    );

    await dispatching().workDue();

    const queued = (id: string) =>
      memory.replays.get(id)?.entries.filter((each) => each.run !== null)
        .length;

    expect(queued('replay_team')).toBe(REPLAY_RUNS_AT_ONCE);
    expect(queued('replay_search')).toBe(3);

    await memory.searchRepository.save(search.stopped(NOW, BY));
    await memory.replayRepository.add(
      aReplay({ id: 'replay_late', count: 2, searchId: search.id }),
    );
    await dispatching().workDue();

    expect(queued('replay_late')).toBe(0);
  });
});

describe('DispatchReplayRuns when Work fails', () => {
  it('counts the failure against the one entry, and still queues the others', async () => {
    await memory.replayRepository.add(aReplay({ count: 2 }));
    let calls = 0;
    const dispatch = work.dispatch;
    work.dispatch = async (order) => {
      calls += 1;
      if (calls === 1) {
        throw new Error('the store answered 503');
      }
      return dispatch(order);
    };

    await dispatching().workDue();

    const [first, second] = memory.replays.get('replay_1')?.entries ?? [];
    expect(first?.queueAttempts).toBe(1);
    expect(first?.queued).toBe(false);
    expect(second?.queued).toBe(true);
    expect(second?.fingerprint).not.toBeNull();
  });

  it('asks Work to forgo a run reserved for a replay stopped before it was queued, freeing its slot only once Work says it never was', async () => {
    await memory.replayRepository.add(aReplay({ count: 2 }));
    work.dispatch = async () => {
      throw new Error('down');
    };
    await dispatching().workDue();
    const replay = memory.replays.get('replay_1');
    await memory.replayRepository.save(
      (replay as NonNullable<typeof replay>).stopped(later(1), BY),
    );
    const kept = memory.replays.get('replay_1')?.entries[0]?.run?.value ?? '';
    work.queuedRuns.add(kept);

    await dispatching().workDue();

    expect(work.forgone.map((each) => each.keep)).toEqual([false, false]);
    const after = memory.replays.get('replay_1');
    expect(after?.occupying.map((each) => each.run?.value)).toEqual([kept]);
    expect(after?.occupying[0]?.fingerprint).not.toBeNull();
  });

  it(`gives up on a run Work failed to queue ${MOST_QUEUE_ATTEMPTS} times only once Work says it never queued it, and keeps one it did`, async () => {
    await memory.replayRepository.add(aReplay({ count: 2 }));
    work.dispatch = async () => {
      throw new Error('down');
    };

    for (let turn = 0; turn < MOST_QUEUE_ATTEMPTS; turn += 1) {
      await dispatching().workDue();
    }
    expect(work.forgone).toEqual([]);
    expect(memory.replays.get('replay_1')?.occupying).toHaveLength(2);

    work.queuedRuns.add(
      memory.replays.get('replay_1')?.entries[1]?.run?.value ?? '',
    );
    await dispatching().workDue();

    expect(work.forgone.map((each) => each.keep)).toEqual([true, true]);
    const [first, second] = memory.replays.get('replay_1')?.entries ?? [];
    expect(first?.refusal).toBe('dispatch-failed');
    expect(second?.queued).toBe(true);
    expect(memory.replays.get('replay_1')?.occupying).toHaveLength(1);
  });
});

describe('DispatchReplayRuns without the candidate', () => {
  it('forgoes the run in Work and settles the entry as unfit, so it holds no slot', async () => {
    await memory.replayRepository.add(aReplay({ count: 1 }));
    memory.candidates.clear();

    await dispatching().workDue();
    await dispatching().workDue();

    const replay = memory.replays.get('replay_1');
    expect(work.forgone.map((each) => each.keep)).toEqual([false]);
    expect(replay?.entries[0]?.refusal).toBe('candidate-unfit');
    expect(replay?.occupying).toEqual([]);
  });
});

describe('NoteLineRedefined', () => {
  it('asks for each set of the line to be checked, then notes one whose station Work no longer has', async () => {
    const set = aSet(1);
    await memory.setRepository.add(set);
    memory.events.length = 0;
    const redefining = new NoteLineRedefined(
      memory.setRepository,
      work,
      TRANSACTION,
      CLOCK,
    );

    expect(await redefining.redefined('line_1')).toEqual([
      new ReplaySetStationCheckDue(set.id, set.workspaceId),
    ]);

    await redefining.check(set.id);
    expect(memory.sets.get('set_1')?.isAtGoneStation).toBe(false);

    let asked = 0;
    work.station = async (lineId, stationId) => {
      asked += 1;
      return asked === 1 ? null : { ...AT_HAND, lineId, stationId };
    };
    await redefining.check(set.id);
    expect(memory.sets.get('set_1')?.isAtGoneStation).toBe(false);

    work.station = async () => null;
    await redefining.check(set.id);
    expect(memory.sets.get('set_1')?.isAtGoneStation).toBe(true);
    expect(memory.events).toHaveLength(1);
    expect(await redefining.redefined('line_1')).toEqual([]);
  });
});

describe('NoteReplayEnded and NoteReplayDigested', () => {
  it('record a replay run’s end and digest on its entry, whichever comes first', async () => {
    await memory.replayRepository.add(aReplay({ count: 1 }));
    await dispatching().workDue();
    const run = memory.replays.get('replay_1')?.entries[0]?.run?.value ?? '';

    await new NoteReplayDigested(
      memory.replayRepository,
      TRANSACTION,
      CLOCK,
    ).digested({
      runId: run,
      ms: 60_000,
      steps: 12,
      changedLines: 4,
      cost: 0.5,
      currency: 'USD',
      tokens: { input: 10, output: 5, cacheRead: null, cacheWrite: null },
    });
    await new NoteReplayEnded(
      memory.replayRepository,
      new FakeChangeReview(),
      TRANSACTION,
      CLOCK,
    ).ended({
      runId: run,
      outcome: 'completed',
      failure: null,
      stopped: false,
      asked: false,
      next: 'ship',
    });

    const replay = memory.replays.get('replay_1');
    expect(replay?.current).toBe('finished');
    expect(replay?.entries[0]?.ending).toBe('completed');
    expect(replay?.spent.amount).toBe(0.5);
  });

  it('pass over a run no replay gave out', async () => {
    await new NoteReplayEnded(
      memory.replayRepository,
      new FakeChangeReview(),
      TRANSACTION,
      CLOCK,
    ).ended({
      runId: 'elsewhere',
      outcome: 'completed',
      failure: null,
      stopped: false,
      asked: false,
      next: null,
    });

    expect(memory.replays.size).toBe(0);
  });
});

describe('HoldSetStartingPoints', () => {
  it('holds the set’s runs, and lets them go once its station or the set is gone', async () => {
    const set = aSet(2);
    await memory.setRepository.add(set);
    const holding = new HoldSetStartingPoints(memory.setRepository, work);

    await holding.changed(set.id);
    expect(work.held.get('replay-set:set_1')).toEqual([
      'original_0',
      'original_1',
    ]);

    await memory.setRepository.save(set.stationLeft(later(1)));
    await holding.changed(set.id);
    expect(work.held.has('replay-set:set_1')).toBe(false);

    await holding.changed(set.id);
    await memory.setRepository.save(
      (memory.sets.get('set_1') as typeof set).deleted(false),
    );
    await holding.changed(set.id);
    expect(work.held.has('replay-set:set_1')).toBe(false);
  });
});

describe('AbandonReplays', () => {
  const abandoning = () =>
    new AbandonReplays(
      memory.setRepository,
      memory.replayRepository,
      memory.candidateRepository,
      TRANSACTION,
    );

  it('asks for each set and candidate of a disbanded team to be abandoned, one by one, leaving its replays to their sets', async () => {
    const set = aSet(2);
    await memory.setRepository.add(set);
    await memory.replayRepository.add(aReplay({ count: 2 }));

    const due = await abandoning().ofTeam(set.teamId, set.workspaceId);

    expect(due.map((each) => each.kind)).toEqual([
      'replays.replay-set-abandonment-due',
      'replays.candidate-abandonment-due',
    ]);
  });

  it('abandons a replay underway by stopping it through its own event, then a set and a candidate', async () => {
    const set = aSet(2);
    await memory.setRepository.add(set);
    await memory.replayRepository.add(aReplay({ count: 2 }));
    await dispatching().workDue();
    memory.events.length = 0;

    await abandoning().replay(ReplayId.of('replay_1'));
    await abandoning().set(set.id);
    await abandoning().candidate(CandidateId.of('candidate_proposed'));
    await abandoning().replay(ReplayId.of('replay_1'));

    expect(memory.events.map((each) => each.kind)).toEqual([
      'replay.stopped',
      'replays.replay-ended',
      'replay-set.deleted',
      'replays.candidate-withdrawn',
    ]);
    expect(memory.replays.size).toBe(0);
    expect(memory.sets.size).toBe(0);
    expect(memory.candidates.size).toBe(0);
  });

  it('asks for the replays of a deleted set to be abandoned', async () => {
    const set = aSet(1);
    await memory.replayRepository.add(aReplay({ count: 1 }));

    expect(await abandoning().ofSet(set.id, set.workspaceId)).toEqual([
      new ReplayAbandonmentDue(ReplayId.of('replay_1'), set.workspaceId),
    ]);
  });
});

describe('LetReplayRunsGo', () => {
  it('forgoes the runs of a stopped replay, and withdraws the queued ones of a replay over budget', async () => {
    const letting = new LetReplayRunsGo(work);

    await letting.stopped([RunId.of('run_1')]);
    await letting.overBudget([RunId.of('run_2')]);

    expect(work.forgone).toEqual([{ run: 'run_1', keep: false }]);
    expect(work.withdrawn).toEqual(['run_2']);
  });
});

describe('scoring a replayed task', () => {
  const JUDGED = 'candidate_judged';
  let changes: FakeChangeReview;
  let outcomes: FakeOutcomes;

  const ending = () =>
    new NoteReplayEnded(memory.replayRepository, changes, TRANSACTION, CLOCK);
  const reviewing = () =>
    new NoteReplayChangeReviewed(
      memory.replayRepository,
      changes,
      TRANSACTION,
      CLOCK,
    );
  const asking = () =>
    new AskForReplayJudging(
      memory.replayRepository,
      memory.candidateRepository,
      outcomes,
      TRANSACTION,
      CLOCK,
    );
  const judging = () =>
    new NoteReplayJudged(memory.replayRepository, TRANSACTION, CLOCK);

  const completed = (runId: string) =>
    ending().ended({
      runId,
      outcome: 'completed',
      failure: null,
      stopped: false,
      asked: false,
      next: 'ship',
    });

  const started = async (candidate = JUDGED): Promise<string> => {
    const replay = aReplay({
      count: 1,
      candidate: candidateOf('proposed', candidate, RUBRIC),
    }).reserving(1, () => RunId.of('replay_run_0'));
    await memory.candidateRepository.add(
      candidateOf('proposed', JUDGED, RUBRIC),
    );
    await memory.replayRepository.add(replay);
    memory.events.length = 0;
    return 'replay_run_0';
  };

  const entry = () => memory.replays.get('replay_1')?.entries[0];

  beforeEach(() => {
    changes = new FakeChangeReview();
    outcomes = new FakeOutcomes();
  });

  it('reads its change’s checks from Change Review when its run ends, and again as they move', async () => {
    const run = await started();
    changes.stacks.set(run, [
      {
        repository: 'api',
        state: 'checking',
        skip: null,
        failedAt: [],
        spent: ModelSpent.of([], 0),
      },
    ]);

    await completed(run);
    expect(entry()?.checks?.state).toBe('checking');

    changes.stacks.set(run, [
      {
        repository: 'api',
        state: 'failed',
        skip: null,
        failedAt: ['the whole change'],
        spent: ModelSpent.of([], 0),
      },
    ]);
    await reviewing().reviewed(run);

    expect(entry()?.checks?.failedAt).toEqual(['the whole change']);
  });

  it('asks the judge to compare the run with the change people accepted for the original', async () => {
    const run = await started();
    outcomes.accepted.add('original_0');

    await completed(run);
    const wanted = memory.events.find(
      (each): each is ReplayJudgingWanted =>
        each.kind === 'replay.judging-wanted',
    );
    if (!wanted) {
      throw new Error('no judging was wanted');
    }
    await asking().wanted(wanted);

    expect(outcomes.asked).toEqual([
      {
        run: RunId.of(run),
        workspaceId: STATION.workspaceId,
        teamId: STATION.teamId,
        judge: JudgeCriteria.of({ rubric: RUBRIC, claims: [], passShare: 1 }),
        reference: RunId.of('original_0'),
      },
    ]);
  });

  it('asks the judge on the rubric alone when people did not accept the original’s change', async () => {
    const run = await started();

    await completed(run);
    await asking().wanted(
      memory.events.find(
        (each) => each.kind === 'replay.judging-wanted',
      ) as ReplayJudgingWanted,
    );

    expect(outcomes.asked[0]?.reference).toBeNull();
  });

  it('records a judge that cannot be asked as unjudged, and finishes', async () => {
    const run = await started();
    outcomes.answer = 'unavailable';

    await completed(run);
    await asking().wanted(
      memory.events.find(
        (each) => each.kind === 'replay.judging-wanted',
      ) as ReplayJudgingWanted,
    );
    await new NoteReplayDigested(
      memory.replayRepository,
      TRANSACTION,
      CLOCK,
    ).digested({
      runId: run,
      ms: 1,
      steps: 1,
      changedLines: 4,
      cost: 0.1,
      currency: 'USD',
      tokens: { input: 1, output: 1, cacheRead: null, cacheWrite: null },
    });

    expect(entry()?.reasons.map((each) => each.code)).toEqual(['unjudged']);
    expect(memory.replays.get('replay_1')?.current).toBe('finished');
  });

  it('takes the judge’s verdict as the entry’s result', async () => {
    const run = await started();

    await completed(run);
    await judging().judged({
      runId: run,
      scale: 'yes-no',
      value: 0,
      marks: null,
      claims: [],
      passShare: 1,
      model: 'judge/model',
      referenced: true,
      reasons: [
        { text: 'It drops a job.', steps: [2], hunks: [], claim: null },
      ],
      spent: ModelSpent.of([Spend.of(0.02, 'USD')], 0),
    });

    expect(entry()?.succeeded).toBe(false);
    expect(entry()?.verdict?.referenced).toBe(true);
    expect(entry()?.reasons).toEqual([
      {
        code: 'judge-failed',
        detail: 'It drops a job.',
        steps: [2],
        hunks: [],
      },
    ]);
  });

  it('records a judging that failed for good as unjudged', async () => {
    const run = await started();

    await completed(run);
    await judging().failed(
      run,
      'refused',
      ModelSpent.of([Spend.of(0.01, 'USD')], 0),
    );

    expect(entry()?.judging?.unjudged).toBe('refused');
    expect(entry()?.succeeded).toBeNull();
  });
});

describe('probing a set', () => {
  let changes: FakeChangeReview;
  let outcomes: FakeOutcomes;

  const PASSED = [
    {
      repository: 'api',
      state: 'passed' as const,
      skip: null,
      failedAt: [],
      spent: ModelSpent.of([], 0),
    },
  ];

  const probed = async () => {
    let next = 0;
    const reserved = aReplay({
      id: 'replay_probe',
      count: 1,
      repeats: 2,
      probe: true,
      candidate: candidateOf('live', 'candidate_probe', RUBRIC, 'npm test'),
    }).reserving(2, () => RunId.of(`probe_run_${next++}`));
    const finished = reserved.entries.reduce((held, entry) => {
      const run = entry.run as RunId;

      return held
        .confirmed(run, FINGERPRINT, NOW)
        .ended(run, endOf('completed'))
        .measured(run, measuresOf(1), later(61_000))
        .reviewed(run, ChangeChecks.of(PASSED), null, later(62_000))
        .judged(
          run,
          JudgeVerdict.of({
            scale: 'yes-no',
            value: 1,
            marks: null,
            claims: [],
            passShare: 1,
            model: 'judge/model',
            referenced: false,
            reasons: [],
          }),
          null,
          later(63_000),
        );
    }, reserved);

    await memory.replayRepository.add(finished);
  };

  const wanted = <T>(kind: string): T[] =>
    memory.events.filter((each) => each.kind === kind) as T[];

  const entries = () => memory.replays.get('replay_probe')?.entries ?? [];

  beforeEach(() => {
    changes = new FakeChangeReview();
    outcomes = new FakeOutcomes();
  });

  it('asks the judge a second time of each judged run once the probe finishes', async () => {
    await probed();

    for (const event of wanted<ReplayRejudgingWanted>(
      'replay.rejudging-wanted',
    )) {
      expect(await new AskForReplayRejudging(outcomes).wanted(event)).toEqual(
        [],
      );
    }

    expect(memory.replays.get('replay_probe')?.current).toBe('finished');
    expect(outcomes.askedAgain).toEqual(['probe_run_0', 'probe_run_1']);
    expect(entries().map((each) => each.secondJudging?.pending)).toEqual([
      true,
      true,
    ]);
  });

  it('says a second judging nobody could ask, and records it as unjudged on its own', async () => {
    await probed();
    outcomes.againAnswer = 'unavailable';

    const [first] = wanted<ReplayRejudgingWanted>('replay.rejudging-wanted');
    const [refused] = await new AskForReplayRejudging(outcomes).wanted(
      first as ReplayRejudgingWanted,
    );

    expect(refused).toBeInstanceOf(ReplayRejudgingRefused);
    expect(entries()[0]?.secondJudging?.pending).toBe(true);

    await new NoteReplayJudged(
      memory.replayRepository,
      TRANSACTION,
      CLOCK,
    ).rejudgingRefused(refused as ReplayRejudgingRefused);

    expect(entries()[0]?.secondJudging?.unjudged).toBe('unavailable');
    expect(entries()[1]?.secondJudging?.pending).toBe(true);
  });

  it('keeps the second verdict beside the first, and a second judging that failed, charging it to the ceiling but not to what the runs cost', async () => {
    await probed();
    const judging = new NoteReplayJudged(
      memory.replayRepository,
      TRANSACTION,
      CLOCK,
    );

    await judging.rejudged({
      runId: 'probe_run_0',
      scale: 'yes-no',
      value: 0,
      marks: null,
      claims: [],
      passShare: 1,
      model: 'judge/model',
      referenced: false,
      reasons: [],
      spent: ModelSpent.of([Spend.of(0.02, 'USD')], 0),
    });
    await judging.rejudgingFailed(
      'probe_run_1',
      'refused',
      ModelSpent.of([], 0),
    );

    const replay = memory.replays.get('replay_probe');

    expect(entries().map((each) => each.judgeAgreed)).toEqual([false, null]);
    expect(entries()[1]?.secondJudging?.unjudged).toBe('refused');
    expect(entries()[0]?.succeeded).toBe(true);
    expect(replay?.spent.amount).toBeCloseTo(2);
    expect(replay?.charged.amount).toBeCloseTo(2.02);
  });

  it('asks Change Review to check each stack of each checked run again, one at a time, and reads what it found', async () => {
    await probed();
    const asking = new AskForReplayRecheck(changes);
    const stacks: ReplayStackRecheckWanted[] = [];

    for (const event of wanted<ReplayRecheckWanted>('replay.recheck-wanted')) {
      stacks.push(
        ...((await asking.wanted(event)) as ReplayStackRecheckWanted[]),
      );
    }
    for (const each of stacks) {
      await asking.stack(each);
    }
    changes.rechecks.set('probe_run_1', [{ ...PASSED[0], state: 'failed' }]);
    await new NoteReplayChangeReviewed(
      memory.replayRepository,
      changes,
      TRANSACTION,
      CLOCK,
    ).rechecked('probe_run_1');

    expect(changes.recheckAsked).toEqual([
      'probe_run_0#stack_1',
      'probe_run_1#stack_1',
    ]);
    expect(entries().map((each) => each.recheck?.state)).toEqual([
      'checking',
      'failed',
    ]);
    expect(entries().map((each) => each.checksFlipped)).toEqual([null, true]);
  });

  it('notes, on its own, a run Change Review had nothing to check again in', async () => {
    await probed();
    changes.recheckableStacks = [];

    const [first] = wanted<ReplayRecheckWanted>('replay.recheck-wanted');
    const [unavailable] = await new AskForReplayRecheck(changes).wanted(
      first as ReplayRecheckWanted,
    );

    expect(unavailable).toBeInstanceOf(ReplayRecheckUnavailable);

    await new NoteReplayChangeReviewed(
      memory.replayRepository,
      changes,
      TRANSACTION,
      CLOCK,
    ).recheckUnavailable(unavailable as ReplayRecheckUnavailable);

    expect(entries()[0]?.recheck?.state).toBe('absent');
    expect(entries()[0]?.checksFlipped).toBeNull();
  });
});
