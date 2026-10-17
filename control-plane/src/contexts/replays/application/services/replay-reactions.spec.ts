import { CancelReplayRuns } from '@replays/application/services/cancel-replay-runs.service';
import { DeleteReplays } from '@replays/application/services/delete-replays.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { HoldSetStartingPoints } from '@replays/application/services/hold-set-starting-points.service';
import { NoteLineChanged } from '@replays/application/services/note-line-changed.service';
import { NoteReplayChangeReviewed } from '@replays/application/services/note-replay-change-reviewed.service';
import { NoteReplayDigested } from '@replays/application/services/note-replay-digested.service';
import { NoteReplayEnded } from '@replays/application/services/note-replay-ended.service';
import { NoteReplayJudged } from '@replays/application/services/note-replay-judged.service';
import {
  CLOCK,
  FakeChangeReview,
  FakeOutcomes,
  FakeWork,
  IDS,
  InMemoryReplays,
  STATION_VIEW,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { RequestReplayJudging } from '@replays/application/services/request-replay-judging.service';
import { RequestReplayRecheck } from '@replays/application/services/request-replay-recheck.service';
import { RequestReplayRejudging } from '@replays/application/services/request-replay-rejudging.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayDeletionRequested } from '@replays/domain/events/replay-deletion-requested.event';
import type { ReplayJudgingRequested } from '@replays/domain/events/replay-judging-requested.event';
import type { ReplayRecheckRequested } from '@replays/domain/events/replay-recheck-requested.event';
import { ReplayRecheckUnavailable } from '@replays/domain/events/replay-recheck-unavailable.event';
import { ReplayRejudgingFailed } from '@replays/domain/events/replay-rejudging-failed.event';
import type { ReplayRejudgingRequested } from '@replays/domain/events/replay-rejudging-requested.event';
import { ReplaySetStationCheckRequested } from '@replays/domain/events/replay-set-station-check-requested.event';
import type { ReplayStackRecheckRequested } from '@replays/domain/events/replay-stack-recheck-requested.event';
import {
  aBudget,
  aReplay,
  aSearch,
  aSet,
  BY,
  candidateOf,
  concludedAll,
  endOf,
  FINGERPRINT,
  LIVE_FINGERPRINT,
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
import { MAX_QUEUE_ATTEMPTS } from '@replays/domain/value-objects/replay-entry.vo';
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

const handedTheAnswer = (oracle: Candidate) => {
  const replay = Replay.start({
    id: ReplayId.of('replay_oracle'),
    set: aSet(3),
    candidate: oracle,
    baseline: false,
    ceiling: Spend.ceiling(10, 'USD'),
    at: NOW,
    by: BY,
    oracle: {
      answers: [
        { run: RunId.of('original_0'), answer: 'accepted' },
        { run: RunId.of('original_1'), answer: 'sent-back' },
      ],
      live: candidateOf('live'),
      against: concludedAll(
        aReplay({
          id: 'replay_live',
          candidate: candidateOf('live'),
          baseline: true,
        }),
      ),
    },
  });

  replay.pullEvents();
  return replay;
};

describe('DispatchReplayRuns', () => {
  it('queues as many of a team’s replay runs as it allows at once, under each replay’s candidate', async () => {
    await memory.replayRepository.add(aReplay({ id: 'replay_a', count: 3 }));
    await memory.replayRepository.add(
      aReplay({ id: 'replay_b', count: 3, at: later(1) }),
    );

    await dispatching().processDue();

    expect(work.dispatched).toHaveLength(REPLAY_RUNS_AT_ONCE);
    expect(work.dispatched.map((each) => each.original.value)).toEqual([
      'original_0',
      'original_1',
    ]);
    expect(work.dispatched[0]?.block.key).toBe('build');
    expect(work.dispatched.every((each) => each.answer === null)).toBe(true);
    expect(memory.replays.get('replay_a')?.unconfirmed).toEqual([]);
    expect(memory.replays.get('replay_b')?.current).toBe('queued');

    await dispatching().processDue();
    expect(work.dispatched).toHaveLength(REPLAY_RUNS_AT_ONCE);
  });

  it('hands each run of a replay handed the answer the answer stored for its original when it started', async () => {
    const oracle = Candidate.oracleOf(candidateOf('live'), {
      id: CandidateId.of('candidate_oracle'),
      at: NOW,
    });
    const replay = handedTheAnswer(oracle);

    await memory.candidateRepository.add(oracle);
    await memory.replayRepository.add(replay);

    await dispatching().processDue();
    await dispatching().processDue();

    expect(
      work.dispatched.map((each) => [each.original.value, each.answer]),
    ).toEqual([
      ['original_0', 'accepted'],
      ['original_1', 'sent-back'],
    ]);
  });

  it('ends an entry Work cannot queue, and moves on to the next', async () => {
    await memory.replayRepository.add(aReplay({ count: 2 }));
    work.unqueued = { queued: false, unreplayableReason: 'archive-gone' };

    await dispatching().processDue();

    expect(
      memory.replays
        .get('replay_1')
        ?.entries.map((each) => each.unreplayableReason),
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

    await dispatching().processDue();

    const queued = (id: string) =>
      memory.replays.get(id)?.entries.filter((each) => each.run !== null)
        .length;

    expect(queued('replay_team')).toBe(REPLAY_RUNS_AT_ONCE);
    expect(queued('replay_search')).toBe(3);

    await memory.searchRepository.save(search.stop(NOW, BY));
    await memory.replayRepository.add(
      aReplay({ id: 'replay_late', count: 2, searchId: search.id }),
    );
    await dispatching().processDue();

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

    await dispatching().processDue();

    const [first, second] = memory.replays.get('replay_1')?.entries ?? [];
    expect(first?.queueAttempts).toBe(1);
    expect(first?.queued).toBe(false);
    expect(second?.queued).toBe(true);
    expect(second?.fingerprint).not.toBeNull();
  });

  it('requests Work to cancel a run reserved for a replay stopped before it was queued, freeing its slot only once Work says it never was', async () => {
    await memory.replayRepository.add(aReplay({ count: 2 }));
    work.dispatch = async () => {
      throw new Error('down');
    };
    await dispatching().processDue();
    const replay = memory.replays.get('replay_1');
    await memory.replayRepository.save(
      (replay as NonNullable<typeof replay>).stop(later(1), BY),
    );
    const queuedRun =
      memory.replays.get('replay_1')?.entries[0]?.run?.value ?? '';
    work.queuedRuns.add(queuedRun);

    await dispatching().processDue();

    expect(work.cancelled.map((each) => each.leaveRunAsIs)).toEqual([
      false,
      false,
    ]);
    const after = memory.replays.get('replay_1');
    expect(after?.occupying.map((each) => each.run?.value)).toEqual([
      queuedRun,
    ]);
    expect(after?.occupying[0]?.fingerprint).not.toBeNull();
  });

  it(`gives up on a run Work failed to queue ${MAX_QUEUE_ATTEMPTS} times only once Work says it never queued it, and keeps one it queued`, async () => {
    await memory.replayRepository.add(aReplay({ count: 2 }));
    work.dispatch = async () => {
      throw new Error('down');
    };

    for (let turn = 0; turn < MAX_QUEUE_ATTEMPTS; turn += 1) {
      await dispatching().processDue();
    }
    expect(work.cancelled).toEqual([]);
    expect(memory.replays.get('replay_1')?.occupying).toHaveLength(2);

    work.queuedRuns.add(
      memory.replays.get('replay_1')?.entries[1]?.run?.value ?? '',
    );
    await dispatching().processDue();

    expect(work.cancelled.map((each) => each.leaveRunAsIs)).toEqual([
      true,
      true,
    ]);
    const [first, second] = memory.replays.get('replay_1')?.entries ?? [];
    expect(first?.unreplayableReason).toBe('dispatch-failed');
    expect(second?.queued).toBe(true);
    expect(memory.replays.get('replay_1')?.occupying).toHaveLength(1);
  });
});

describe('DispatchReplayRuns without the candidate', () => {
  it('cancels the run in Work and ends the entry as unfit, so it takes no slot', async () => {
    await memory.replayRepository.add(aReplay({ count: 1 }));
    memory.candidates.clear();

    await dispatching().processDue();
    await dispatching().processDue();

    const replay = memory.replays.get('replay_1');
    expect(work.cancelled.map((each) => each.leaveRunAsIs)).toEqual([false]);
    expect(replay?.entries[0]?.unreplayableReason).toBe('candidate-unfit');
    expect(replay?.occupying).toEqual([]);
  });
});

const noteLineChanged = () =>
  new NoteLineChanged(
    memory.setRepository,
    memory.replayRepository,
    memory.candidateRepository,
    work,
    TRANSACTION,
    CLOCK,
  );

describe('NoteLineChanged', () => {
  it('stops a replay handed the answer once the live config it replays is no longer live', async () => {
    const set = aSet(3);
    const oracle = Candidate.oracleOf(candidateOf('live'), {
      id: CandidateId.of('candidate_oracle'),
      at: NOW,
    });
    await memory.setRepository.add(set);
    await memory.candidateRepository.add(oracle);
    await memory.replayRepository.add(handedTheAnswer(oracle));

    await noteLineChanged().check(set.id);
    expect(memory.replays.get('replay_oracle')?.stoppedAt).toBeNull();

    const live = work.live;
    work.live = async () => ({
      ...(await live()),
      fingerprint: LIVE_FINGERPRINT,
    });
    await noteLineChanged().check(set.id);
    expect(memory.replays.get('replay_oracle')?.stoppedAt).toEqual(NOW);
  });

  it('requests a check of each set of the line, then notes one whose station Work no longer has', async () => {
    const set = aSet(1);
    await memory.setRepository.add(set);
    memory.events.length = 0;
    const lineChanges = noteLineChanged();

    expect(await lineChanges.changed('line_1')).toEqual([
      new ReplaySetStationCheckRequested(set.id, set.workspaceId),
    ]);

    await lineChanges.check(set.id);
    expect(memory.sets.get('set_1')?.isAtGoneStation).toBe(false);

    let calls = 0;
    work.station = async (lineId, stationId) => {
      calls += 1;
      return calls === 1 ? null : { ...STATION_VIEW, lineId, stationId };
    };
    await lineChanges.check(set.id);
    expect(memory.sets.get('set_1')?.isAtGoneStation).toBe(false);

    work.station = async () => null;
    await lineChanges.check(set.id);
    expect(memory.sets.get('set_1')?.isAtGoneStation).toBe(true);
    expect(memory.events).toHaveLength(1);
    expect(await lineChanges.changed('line_1')).toEqual([]);
  });
});

describe('NoteReplayEnded and NoteReplayDigested', () => {
  it('record a replay run’s end and digest on its entry, whichever comes first', async () => {
    await memory.replayRepository.add(aReplay({ count: 1 }));
    await dispatching().processDue();
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

  it('pass over a run no replay handed out', async () => {
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
  it('puts a starting point hold on the set’s runs, and releases it once its station or the set is gone', async () => {
    const set = aSet(2);
    await memory.setRepository.add(set);
    const startingPointHolds = new HoldSetStartingPoints(
      memory.setRepository,
      work,
    );

    await startingPointHolds.changed(set.id);
    expect(work.startingPointHolds.get('replay-set:set_1')).toEqual([
      'original_0',
      'original_1',
    ]);

    await memory.setRepository.save(set.stationLeft(later(1)));
    await startingPointHolds.changed(set.id);
    expect(work.startingPointHolds.has('replay-set:set_1')).toBe(false);

    await startingPointHolds.changed(set.id);
    await memory.setRepository.save(
      (memory.sets.get('set_1') as typeof set).delete(false),
    );
    await startingPointHolds.changed(set.id);
    expect(work.startingPointHolds.has('replay-set:set_1')).toBe(false);
  });
});

describe('DeleteReplays', () => {
  const deleting = () =>
    new DeleteReplays(
      memory.setRepository,
      memory.replayRepository,
      memory.candidateRepository,
      TRANSACTION,
    );

  it('requests the deletion of each set and candidate of a deleted team, one by one, leaving its replays to their sets', async () => {
    const set = aSet(2);
    await memory.setRepository.add(set);
    await memory.replayRepository.add(aReplay({ count: 2 }));

    const due = await deleting().deleteForTeam(set.teamId, set.workspaceId);

    expect(due.map((each) => each.kind)).toEqual([
      'replays.replay-set-deletion-requested',
      'replays.candidate-deletion-requested',
    ]);
  });

  it('deletes a replay underway by stopping it through its own event, then a set and a candidate', async () => {
    const set = aSet(2);
    await memory.setRepository.add(set);
    await memory.replayRepository.add(aReplay({ count: 2 }));
    await dispatching().processDue();
    memory.events.length = 0;

    await deleting().replay(ReplayId.of('replay_1'));
    await deleting().set(set.id);
    await deleting().candidate(CandidateId.of('candidate_proposed'));
    await deleting().replay(ReplayId.of('replay_1'));

    expect(memory.events.map((each) => each.kind)).toEqual([
      'replay.stopped',
      'replays.replay-ended',
      'replay-set.deleted',
      'replays.candidate-deleted',
    ]);
    expect(memory.replays.size).toBe(0);
    expect(memory.sets.size).toBe(0);
    expect(memory.candidates.size).toBe(0);
  });

  it('requests the deletion of the replays of a deleted set', async () => {
    const set = aSet(1);
    await memory.replayRepository.add(aReplay({ count: 1 }));

    expect(await deleting().deleteForSet(set.id, set.workspaceId)).toEqual([
      new ReplayDeletionRequested(ReplayId.of('replay_1'), set.workspaceId),
    ]);
  });
});

describe('CancelReplayRuns', () => {
  it('cancels the runs of a stopped replay, and the queued runs of a replay over budget', async () => {
    const cancelling = new CancelReplayRuns(work);

    await cancelling.stopped([RunId.of('run_1')]);
    await cancelling.overBudget([RunId.of('run_2')]);

    expect(work.cancelled).toEqual([{ run: 'run_1', leaveRunAsIs: false }]);
    expect(work.cancelledQueued).toEqual(['run_2']);
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
  const requestingJudging = () =>
    new RequestReplayJudging(
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

  it('requests the judge to compare the run with the change people accepted for the original', async () => {
    const run = await started();
    outcomes.accepted.add('original_0');

    await completed(run);
    const wanted = memory.events.find(
      (each): each is ReplayJudgingRequested =>
        each.kind === 'replay.judging-requested',
    );
    if (!wanted) {
      throw new Error('no judging was wanted');
    }
    await requestingJudging().requested(wanted);

    expect(outcomes.judgingRequests).toEqual([
      {
        run: RunId.of(run),
        workspaceId: STATION.workspaceId,
        teamId: STATION.teamId,
        judge: JudgeCriteria.of({ rubric: RUBRIC, claims: [], passShare: 1 }),
        reference: RunId.of('original_0'),
      },
    ]);
  });

  it('requests judging on the rubric alone when people did not accept the original’s change', async () => {
    const run = await started();

    await completed(run);
    await requestingJudging().requested(
      memory.events.find(
        (each) => each.kind === 'replay.judging-requested',
      ) as ReplayJudgingRequested,
    );

    expect(outcomes.judgingRequests[0]?.reference).toBeNull();
  });

  it('records a judge that cannot take the request as unjudged, and finishes', async () => {
    const run = await started();
    outcomes.answer = 'unavailable';

    await completed(run);
    await requestingJudging().requested(
      memory.events.find(
        (each) => each.kind === 'replay.judging-requested',
      ) as ReplayJudgingRequested,
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
      'request-failed',
      ModelSpent.of([Spend.of(0.01, 'USD')], 0),
    );

    expect(entry()?.judging?.unjudged).toBe('request-failed');
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
    const finished = reserved.entries.reduce((built, entry) => {
      const run = entry.run as RunId;

      return built
        .confirm(run, FINGERPRINT, NOW)
        .recordRunEnd(run, endOf('completed'))
        .measure(run, measuresOf(1), later(61_000))
        .recordReview(run, ChangeChecks.of(PASSED), null, later(62_000))
        .recordVerdict(
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

  it('requests a second judging of each judged run once the probe finishes', async () => {
    await probed();

    for (const event of wanted<ReplayRejudgingRequested>(
      'replay.rejudging-requested',
    )) {
      expect(
        await new RequestReplayRejudging(outcomes).requested(event),
      ).toEqual([]);
    }

    expect(memory.replays.get('replay_probe')?.current).toBe('finished');
    expect(outcomes.rejudgingRequests).toEqual(['probe_run_0', 'probe_run_1']);
    expect(entries().map((each) => each.secondJudging?.pending)).toEqual([
      true,
      true,
    ]);
  });

  it('says a second judging nobody could request, and records it as unjudged on its own', async () => {
    await probed();
    outcomes.againAnswer = 'unavailable';

    const [first] = wanted<ReplayRejudgingRequested>(
      'replay.rejudging-requested',
    );
    const [failed] = await new RequestReplayRejudging(outcomes).requested(
      first as ReplayRejudgingRequested,
    );

    expect(failed).toBeInstanceOf(ReplayRejudgingFailed);
    expect(entries()[0]?.secondJudging?.pending).toBe(true);

    await new NoteReplayJudged(
      memory.replayRepository,
      TRANSACTION,
      CLOCK,
    ).rejudgingRequestFailed(failed as ReplayRejudgingFailed);

    expect(entries()[0]?.secondJudging?.unjudged).toBe('unavailable');
    expect(entries()[1]?.secondJudging?.pending).toBe(true);
  });

  it('records the second verdict beside the first, and a second judging that failed, charging it to the ceiling but not to what the runs cost', async () => {
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
      'request-failed',
      ModelSpent.of([], 0),
    );

    const replay = memory.replays.get('replay_probe');

    expect(entries().map((each) => each.judgeAgreed)).toEqual([false, null]);
    expect(entries()[1]?.secondJudging?.unjudged).toBe('request-failed');
    expect(entries()[0]?.succeeded).toBe(true);
    expect(replay?.spent.amount).toBeCloseTo(2);
    expect(replay?.charged.amount).toBeCloseTo(2.02);
  });

  it('requests Change Review to check each stack of each checked run again, one at a time, and reads what it found', async () => {
    await probed();
    const requesting = new RequestReplayRecheck(changes);
    const stacks: ReplayStackRecheckRequested[] = [];

    for (const event of wanted<ReplayRecheckRequested>(
      'replay.recheck-requested',
    )) {
      stacks.push(
        ...((await requesting.requested(
          event,
        )) as ReplayStackRecheckRequested[]),
      );
    }
    for (const each of stacks) {
      await requesting.stack(each);
    }
    changes.rechecks.set('probe_run_1', [{ ...PASSED[0], state: 'failed' }]);
    await new NoteReplayChangeReviewed(
      memory.replayRepository,
      changes,
      TRANSACTION,
      CLOCK,
    ).rechecked('probe_run_1');

    expect(changes.recheckRequests).toEqual([
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

    const [first] = wanted<ReplayRecheckRequested>('replay.recheck-requested');
    const [unavailable] = await new RequestReplayRecheck(changes).requested(
      first as ReplayRecheckRequested,
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
