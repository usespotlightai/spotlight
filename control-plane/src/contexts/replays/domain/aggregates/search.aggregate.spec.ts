import { Search } from '@replays/domain/aggregates/search.aggregate';
import { SearchCandidatePicked } from '@replays/domain/events/search-candidate-picked.event';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchHoldingOutRequested } from '@replays/domain/events/search-holding-out-requested.event';
import { SearchIterationRequested } from '@replays/domain/events/search-iteration-requested.event';
import { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import { SearchStarted } from '@replays/domain/events/search-started.event';
import { InvalidFailureCauseError } from '@replays/domain/exceptions/invalid-failure-cause.error';
import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';
import { ReplaySetStationGoneError } from '@replays/domain/exceptions/replay-set-station-gone.error';
import { SearchCandidateNameTakenError } from '@replays/domain/exceptions/search-candidate-name-taken.error';
import { SearchIterationClosedError } from '@replays/domain/exceptions/search-iteration-closed.error';
import { SearchNotReflectingError } from '@replays/domain/exceptions/search-not-reflecting.error';
import { SearchProposalsExhaustedError } from '@replays/domain/exceptions/search-proposals-exhausted.error';
import { SearchReflectingError } from '@replays/domain/exceptions/search-reflecting.error';
import { UnknownSearchTaskError } from '@replays/domain/exceptions/unknown-search-task.error';
import {
  AGENT,
  aBudget,
  aSearch,
  aSet,
  BY,
  candidateOf,
  later,
  NOW,
  replayedAs,
  replayFor,
  SEARCH_ID,
  searchRunIds,
  sha256,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayStopReason } from '@replays/domain/value-objects/replay-state';
import {
  ATTEMPTS_PER_PROPOSAL,
  SearchIteration,
} from '@replays/domain/value-objects/search-iteration.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const SEED = ReplayId.of('replay_seed');

const usd = (amount: number) => Money.of(amount, 'USD');

const charged = (amount: number, unpriced = 0) => ({
  spent: usd(amount),
  unpriced,
});

const NO_SPEND = ModelSpent.of([], 0);

const run = (number: number) => RunId.of(`search_run_${number}`);

const searching = (search = aSearch(), runIds = searchRunIds()): Search => {
  const seeded = search.recordReplayStopReason(
    SEED,
    'finished',
    charged(5),
    NOW,
    runIds,
    true,
  );

  seeded.pullEvents();

  return seeded;
};

const proposal = (name: string, replay = `replay_${name}`) => ({
  candidateId: CandidateId.of(`candidate_${name}`),
  name: CandidateName.searched(name),
  replayId: ReplayId.of(replay),
});

const proposing = (
  search: Search,
  number: number,
  names: readonly string[],
): Search =>
  names.reduce(
    (built, name) => built.acceptProposal(run(number), proposal(name)),
    search,
  );

const endingReplays = (
  search: Search,
  names: readonly string[],
  end: ReplayStopReason,
  runIds: () => RunId,
  spent = 1,
  improved = true,
): Search =>
  names.reduce(
    (built, name) =>
      built.recordReplayStopReason(
        ReplayId.of(`replay_${name}`),
        end,
        charged(spent),
        later(1),
        runIds,
        improved,
      ),
    search,
  );

const iterated = (
  search: Search,
  number: number,
  names: readonly string[],
  runIds: () => RunId,
  end: ReplayStopReason = 'finished',
): Search =>
  endingReplays(
    proposing(search, number, names)
      .recordRunEnd(
        run(number),
        { failed: false, started: true },
        later(1),
        runIds,
      )
      .recordAgentSpend(run(number), NO_SPEND, later(1), runIds),
    names,
    end,
    runIds,
  );

const stalled = (
  budget = aBudget({ iterations: 4 }),
  runIds = searchRunIds(),
): Search =>
  [1, 2].reduce(
    (built, number) =>
      built
        .recordRunEnd(
          run(number),
          { failed: number === 1, started: true },
          later(number),
          runIds,
        )
        .recordAgentSpend(run(number), NO_SPEND, later(number), runIds),
    searching(aSearch({ budget }), runIds),
  );

describe('Search', () => {
  describe('starting', () => {
    it('seeds itself from the live config, saying who started it, with what budget', () => {
      const set = aSet(10);
      const split = HeldOutSplit.drawn({
        searchId: SEARCH_ID,
        entries: set.entries,
        hash: sha256,
      });
      const started = Search.start({
        id: SEARCH_ID,
        calibrates: false,
        set,
        agent: AGENT,
        budget: aBudget(),
        objective: 'success',
        split,
        seed: { candidate: candidateOf('live'), replayId: SEED },
        trigger: 'schedule',
        at: NOW,
        by: BY,
      });

      expect(started.current).toBe('seeding');
      expect(started.isActive).toBe(true);
      expect(started.seed.replay.replayId).toEqual(SEED);
      expect(started.iterations).toEqual([]);
      expect(started.pullEvents()).toEqual([
        new SearchStarted(
          SEARCH_ID,
          set.teamId,
          ConfigurationChange.created(
            {
              resource: 'replay-search',
              id: SEARCH_ID.value,
              key: SEARCH_ID.value,
            },
            BY,
            expect.anything(),
          ),
        ),
      ]);
    });

    it('records the agent, budget and how many tasks it holds out', () => {
      const set = aSet(10);
      const started = Search.start({
        id: SEARCH_ID,
        calibrates: false,
        set,
        agent: AGENT,
        budget: aBudget({ iterations: 4, perIteration: 3, concurrency: 6 }),
        objective: 'success',
        split: HeldOutSplit.drawn({
          searchId: SEARCH_ID,
          entries: set.entries,
          hash: sha256,
        }),
        seed: { candidate: candidateOf('live'), replayId: SEED },
        trigger: 'schedule',
        at: NOW,
        by: BY,
      });
      const [event] = started.pullEvents() as SearchStarted[];

      expect(event?.change.recordedDetail).toEqual({
        set: 'set_1',
        station: 'station_build',
        harness: 'claude-code',
        model: 'opus',
        effort: 'high',
        iterations: 4,
        perIteration: 3,
        concurrency: 6,
        ceiling: '100 USD',
        heldOutTasks: 3,
        repeats: 1,
        objective: 'success',
      });
    });

    it('splits exactly the runs of its set', () => {
      const set = aSet(10);

      expect(() =>
        Search.start({
          id: SEARCH_ID,
          calibrates: false,
          set,
          agent: AGENT,
          budget: aBudget(),
          objective: 'success',
          split: HeldOutSplit.drawn({
            searchId: SEARCH_ID,
            entries: aSet(9).entries,
            hash: sha256,
          }),
          seed: { candidate: candidateOf('live'), replayId: SEED },
          trigger: 'schedule',
          at: NOW,
          by: BY,
        }),
      ).toThrow(InvalidSearchError);
    });

    it('starts only from the live config', () => {
      const set = aSet(10);

      expect(() =>
        Search.start({
          id: SEARCH_ID,
          calibrates: false,
          set,
          agent: AGENT,
          budget: aBudget(),
          objective: 'success',
          split: HeldOutSplit.drawn({
            searchId: SEARCH_ID,
            entries: set.entries,
            hash: sha256,
          }),
          seed: { candidate: candidateOf('searched'), replayId: SEED },
          trigger: 'schedule',
          at: NOW,
          by: BY,
        }),
      ).toThrow(InvalidSearchError);
    });

    it('starts nothing on a set whose station is gone', () => {
      expect(() => aSearch({ set: aSet(10).stationLeft(NOW) })).toThrow(
        ReplaySetStationGoneError,
      );
    });

    it('rejects a budget too thin to give each replay a cent', () => {
      expect(() =>
        aSearch({
          budget: aBudget({ iterations: 10, perIteration: 5, ceiling: 0.2 }),
          objective: 'success',
        }),
      ).toThrow(InvalidSearchError);
    });
  });

  describe('seeding', () => {
    it('wants its first iteration once its seed replay finished', () => {
      const runIds = searchRunIds();
      const seeded = aSearch().recordReplayStopReason(
        SEED,
        'finished',
        charged(5),
        NOW,
        runIds,
        true,
      );

      expect(seeded.current).toBe('searching');
      expect(seeded.activeRun).toEqual(run(1));
      expect(seeded.iterations.map((each) => each.current)).toEqual(['wanted']);
      expect(seeded.spent.amount).toBe(5);
      expect(seeded.pullEvents()).toEqual([
        new SearchIterationRequested(SEARCH_ID, seeded.workspaceId, 1, run(1)),
      ]);
    });

    it('ends, its ceiling reached, when its seed replay reached its ceiling', () => {
      const over = aSearch().recordReplayStopReason(
        SEED,
        'ceiling-reached',
        charged(50),
        NOW,
        searchRunIds(),
        true,
      );

      expect(over.current).toBe('finished');
      expect(over.stopReason).toBe('ceiling-reached');
      expect(over.iterations).toEqual([]);
    });

    it.each(['stopped', 'deleted'] as const)(
      'ends, its seed failed, when its seed replay ended %s',
      (end) => {
        const failed = aSearch().recordReplayStopReason(
          SEED,
          end,
          charged(5),
          NOW,
          searchRunIds(),
          true,
        );

        expect(failed.current).toBe('stopped');
        expect(failed.stopReason).toBe('seed-failed');
        expect(failed.endedAt).toEqual(NOW);
        expect(failed.pullEvents()).toEqual([
          new SearchEnded(
            SEARCH_ID,
            failed.workspaceId,
            'stopped',
            'seed-failed',
            null,
            [],
          ),
        ]);
      },
    );

    it('takes no candidates while seeding', () => {
      expect(() => aSearch().acceptProposal(run(1), proposal('terse'))).toThrow(
        SearchIterationClosedError,
      );
    });
  });

  describe('proposing', () => {
    it('accepts a candidate from its active run', () => {
      const accepted = searching().acceptProposal(run(1), proposal('terse'));

      expect(accepted.proposals.map((each) => each.name.value)).toEqual([
        'terse',
      ]);
      expect(accepted.pullEvents()).toEqual([]);
    });

    it('takes at most its per-iteration number of candidates from one run', () => {
      const full = proposing(searching(), 1, ['one', 'two']);

      expect(() => full.acceptProposal(run(1), proposal('three'))).toThrow(
        SearchProposalsExhaustedError,
      );
    });

    it(`stops taking proposals from a run that tried ${ATTEMPTS_PER_PROPOSAL} times its number`, () => {
      let search = searching();

      for (let tried = 0; tried < 2 * ATTEMPTS_PER_PROPOSAL; tried += 1) {
        search = search.proposalRejected(run(1));
      }

      expect(search.iterations[0]?.attempts).toBe(6);
      expect(() => search.acceptProposal(run(1), proposal('late'))).toThrow(
        SearchProposalsExhaustedError,
      );
      expect(() => search.proposalRejected(run(1))).toThrow(
        SearchProposalsExhaustedError,
      );
    });

    it('takes no candidate once its run ended, nor from a run that was never its run', () => {
      const ended = searching()
        .recordRunEnd(
          run(1),
          { failed: false, started: true },
          later(1),
          searchRunIds(),
        )
        .recordAgentSpend(run(1), NO_SPEND, later(1), searchRunIds());

      expect(() => ended.acceptProposal(run(1), proposal('late'))).toThrow(
        SearchIterationClosedError,
      );
      expect(() =>
        searching().acceptProposal(run(9), proposal('other')),
      ).toThrow(SearchIterationClosedError);
    });

    it('rejects a name it used already, in any iteration', () => {
      const runIds = searchRunIds();
      const first = iterated(
        searching(aSearch(), runIds),
        1,
        ['terse'],
        runIds,
      );

      expect(first.activeRun).toEqual(run(2));
      expect(() =>
        first.acceptProposal(run(2), proposal('terse', 'replay_x')),
      ).toThrow(SearchCandidateNameTakenError);
    });
  });

  describe('iterating', () => {
    it('closes an iteration only once its run and every replay it proposed ended, then wants the next', () => {
      const runIds = searchRunIds();
      const proposed = proposing(searching(aSearch(), runIds), 1, [
        'one',
        'two',
      ]);
      const runOver = proposed
        .recordRunEnd(
          run(1),
          { failed: false, started: true },
          later(1),
          runIds,
        )
        .recordAgentSpend(run(1), NO_SPEND, later(1), runIds);

      expect(runOver.iterations).toHaveLength(1);

      const oneLeft = endingReplays(runOver, ['one'], 'finished', runIds);

      expect(oneLeft.iterations).toHaveLength(1);

      const next = endingReplays(oneLeft, ['two'], 'ceiling-reached', runIds);

      expect(next.iterations.map((each) => each.current)).toEqual([
        'ended',
        'wanted',
      ]);
      expect(next.pullEvents().slice(-1)[0]).toEqual(
        new SearchIterationRequested(SEARCH_ID, next.workspaceId, 2, run(2)),
      );
    });

    it('takes word of a replay’s end once', () => {
      const runIds = searchRunIds();
      const seeded = searching(aSearch(), runIds);
      const proposed = proposing(seeded, 1, ['one']);
      const ended = endingReplays(proposed, ['one'], 'finished', runIds);

      const again = endingReplays(ended, ['one'], 'stopped', runIds, 9);

      expect(again.proposals[0]?.replay.end).toBe('finished');
      expect(again.proposals[0]?.replay.spent?.amount).toBe(9);
      expect(again.iterations).toHaveLength(ended.iterations.length);
      expect(endingReplays(ended, ['one'], 'stopped', runIds, 0.5)).toBe(ended);
      expect(
        seeded.recordReplayStopReason(
          SEED,
          'stopped',
          charged(1),
          NOW,
          runIds,
          true,
        ),
      ).toBe(seeded);
    });

    it('takes what a replay spent after it ended, only ever more, and adds it to the spend of the next iteration', () => {
      const runIds = searchRunIds();
      const seeded = searching(aSearch(), runIds);
      const grown = seeded.replaySpent(SEED, charged(7));

      expect(grown.seed.replay.spent?.amount).toBe(7);
      expect(grown.spent.amount).toBe(7);
      expect(grown.replaySpent(SEED, charged(6))).toBe(grown);
      expect(
        grown.replaySpent(SEED, { spent: Money.of(9, 'EUR'), unpriced: 0 }),
      ).toBe(grown);
      expect(grown.replaySpent(ReplayId.of('elsewhere'), charged(9))).toBe(
        grown,
      );
      expect(
        aSearch().replaySpent(SEED, charged(3)).seed.replay.spent,
      ).toBeNull();
    });

    it('closes an iteration only once its agent’s spend is known, however late it comes', () => {
      const runIds = searchRunIds();
      const ended = searching(aSearch(), runIds).recordRunEnd(
        run(1),
        { failed: false, started: true },
        later(1),
        runIds,
      );

      expect(ended.activeRun).toBeNull();
      expect(ended.awaitingAgentSpend.map((each) => each.number)).toEqual([1]);

      const spent = ended.recordAgentSpend(
        run(1),
        ModelSpent.of([usd(2)], 0),
        later(2),
        runIds,
      );

      expect(spent.activeRun).toEqual(run(2));
      expect(spent.spent.amount).toBe(7);
      expect(
        spent.recordAgentSpend(
          run(1),
          ModelSpent.of([usd(9)], 0),
          later(3),
          runIds,
        ).spent.amount,
      ).toBe(7);
    });

    it('closes an iteration whose run never started without waiting for a spend', () => {
      const runIds = searchRunIds();
      const cancelled = searching(aSearch(), runIds).recordRunEnd(
        run(1),
        { failed: true, started: false },
        later(1),
        runIds,
      );

      expect(cancelled.activeRun).toEqual(run(2));
      expect(cancelled.iterations[0]?.agentSpent?.unpriced).toBe(0);
    });

    it('charges an unpriced or foreign agent run its whole limit, and searches on while that fits', () => {
      for (const spent of [
        ModelSpent.of([usd(0.1)], 1),
        ModelSpent.of([Money.of(0.1, 'EUR')], 0),
      ]) {
        const runIds = searchRunIds();
        const seeded = searching(
          aSearch({ budget: aBudget({ iterations: 5 }) }),
          runIds,
        );
        const search = endingReplays(
          proposing(seeded, 1, ['one'])
            .recordRunEnd(
              run(1),
              { failed: false, started: true },
              later(1),
              runIds,
            )
            .recordAgentSpend(run(1), spent, later(1), runIds),
          ['one'],
          'finished',
          runIds,
        );

        expect(
          search.spent.equals(usd(6).plus(seeded.ceilingSplit.agentRun)),
        ).toBe(true);
        expect(search.current).toBe('searching');
        expect(search.activeRun).toEqual(run(2));
      }
    });

    it('charges each unpriced or foreign run of a replay its share per run', () => {
      const seeded = aSearch().recordReplayStopReason(
        SEED,
        'finished',
        charged(5, 3),
        NOW,
        searchRunIds(),
        true,
      );

      expect(
        seeded.spent.equals(
          usd(5).plus(seeded.ceilingSplit.perRun.scaled(3, 1)),
        ),
      ).toBe(true);
      expect(seeded.replaySpent(SEED, charged(5, 2))).toBe(seeded);
      expect(seeded.replaySpent(SEED, charged(5, 4)).seed.replay.unpriced).toBe(
        4,
      );
    });

    it('takes word that Work queued its run, and what its agent spent', () => {
      const runIds = searchRunIds();
      const search = searching(aSearch(), runIds)
        .queueRun(run(1))
        .recordAgentSpend(
          run(1),
          ModelSpent.of([usd(2), Money.of(1, 'EUR')], 0),
          later(1),
          runIds,
        );

      expect(search.iterations[0]?.current).toBe('running');
      expect(search.spent.amount).toBe(5 + search.ceilingSplit.agentRun.amount);
    });

    it('looks into why it stalled, as an iteration of its own, once two in a row came to nothing and a reflection and one more iteration are left', () => {
      const search = stalled();
      const [, , reflection] = search.iterations;

      expect(search.current).toBe('searching');
      expect(search.iterations.map((each) => each.kind)).toEqual([
        'propose',
        'propose',
        'reflect',
      ]);
      expect(reflection?.current).toBe('wanted');
      expect(search.activeRun).toEqual(run(3));
    });

    it('ends stalled without looking into why when only one iteration is left after two came to nothing', () => {
      const search = stalled(aBudget({ iterations: 3 }));

      expect(search.current).toBe('finished');
      expect(search.stopReason).toBe('stalled');
      expect(search.iterations.map((each) => each.kind)).toEqual([
        'propose',
        'propose',
      ]);
    });

    it('counts an iteration whose candidates finished but beat nothing before them as coming to nothing', () => {
      const runIds = searchRunIds();
      const seeded = searching(
        aSearch({ budget: aBudget({ iterations: 5 }) }),
        runIds,
      );
      const flat = (search: Search, number: number, name: string) =>
        endingReplays(
          proposing(search, number, [name])
            .recordRunEnd(
              run(number),
              { failed: false, started: true },
              later(number),
              runIds,
            )
            .recordAgentSpend(run(number), NO_SPEND, later(number), runIds),
          [name],
          'finished',
          runIds,
          1,
          false,
        );
      const twice = flat(flat(seeded, 1, 'one'), 2, 'two');

      expect(twice.iterations.map((each) => each.kind)).toEqual([
        'propose',
        'propose',
        'reflect',
      ]);
      expect(twice.proposals.map((each) => each.improved)).toEqual([
        false,
        false,
      ]);
    });

    it('ends having spent its iterations, without looking into why, when none is left after two came to nothing', () => {
      const search = stalled(aBudget({ iterations: 2 }));

      expect(search.current).toBe('finished');
      expect(search.stopReason).toBe('iterations-spent');
      expect(search.iterations.map((each) => each.kind)).toEqual([
        'propose',
        'propose',
      ]);
    });

    it('does not count an iteration whose run failed as coming to nothing when one of its candidates improved', () => {
      const runIds = searchRunIds();
      const improvedThenFailed = endingReplays(
        proposing(
          searching(aSearch({ budget: aBudget({ iterations: 5 }) }), runIds),
          1,
          ['good'],
        ),
        ['good'],
        'finished',
        runIds,
      )
        .recordRunEnd(run(1), { failed: true, started: true }, later(1), runIds)
        .recordAgentSpend(run(1), NO_SPEND, later(1), runIds);
      const search = improvedThenFailed
        .recordRunEnd(run(2), { failed: true, started: true }, later(2), runIds)
        .recordAgentSpend(run(2), NO_SPEND, later(2), runIds);

      expect(search.iterations[0]?.current).toBe('failed');
      expect(search.iterations[0]?.cameToNothing).toBe(false);
      expect(search.iterations[1]?.cameToNothing).toBe(true);
      expect(search.iterations.map((each) => each.kind)).toEqual([
        'propose',
        'propose',
        'propose',
      ]);
    });

    it('keeps going after one iteration that came to nothing, when the next finds something', () => {
      const runIds = searchRunIds();
      const search = iterated(
        searching(aSearch({ budget: aBudget({ iterations: 5 }) }), runIds)
          .recordRunEnd(
            run(1),
            { failed: true, started: true },
            later(1),
            runIds,
          )
          .recordAgentSpend(run(1), NO_SPEND, later(1), runIds),
        2,
        ['good'],
        runIds,
      )
        .recordRunEnd(
          run(3),
          { failed: false, started: true },
          later(3),
          runIds,
        )
        .recordAgentSpend(run(3), NO_SPEND, later(3), runIds);

      expect(search.current).toBe('searching');
      expect(search.iterations).toHaveLength(4);
    });

    it('holds out its candidates once its iterations are spent', () => {
      const runIds = searchRunIds();
      let search = searching(aSearch(), runIds);

      search = iterated(search, 1, ['one'], runIds);
      search = iterated(search, 2, ['two'], runIds);
      search.pullEvents();
      search = iterated(search, 3, ['three'], runIds);

      expect(search.current).toBe('holding-out');
      expect(search.stopReason).toBe('iterations-spent');
      expect(search.endedAt).toBeNull();
      expect(search.pullEvents()).toEqual([
        new SearchHoldingOutRequested(SEARCH_ID, search.workspaceId),
      ]);
    });

    it('finishes without holding out when no candidate’s replay finished', () => {
      const runIds = searchRunIds();
      let search = searching(
        aSearch({ budget: aBudget({ iterations: 1 }) }),
        runIds,
      );

      search = iterated(search, 1, ['one'], runIds, 'stopped');

      expect(search.current).toBe('finished');
      expect(search.stopReason).toBe('iterations-spent');
      expect(search.pullEvents().slice(-1)[0]).toEqual(
        new SearchEnded(
          SEARCH_ID,
          search.workspaceId,
          'finished',
          'iterations-spent',
          null,
          [],
        ),
      );
    });

    it('stops searching once another iteration would not fit under its ceiling', () => {
      const runIds = searchRunIds();
      const search = endingReplays(
        proposing(
          searching(
            aSearch({ budget: aBudget({ iterations: 5, ceiling: 20 }) }),
            runIds,
          ),
          1,
          ['costly'],
        )
          .recordRunEnd(
            run(1),
            { failed: false, started: true },
            later(1),
            runIds,
          )
          .recordAgentSpend(run(1), NO_SPEND, later(1), runIds),
        ['costly'],
        'finished',
        runIds,
        12,
      );

      expect(search.current).toBe('holding-out');
      expect(search.stopReason).toBe('ceiling-reached');
    });
  });

  describe('reflecting', () => {
    const searchedTask = (search: Search, at = 0) => {
      const entry = search.split.searched[at];

      if (!entry) {
        throw new Error(`no searched task ${at}`);
      }

      return ReflectedTask.of({
        taskId: entry.taskId,
        originalRunId: entry.runId,
        replayRunId: RunId.of(`replayed_${entry.runId.value}`),
      });
    };

    const reflecting = (budget = aBudget({ iterations: 4 })): Search => {
      const search = stalled(budget, runIds);

      return search.reflectingOn(
        run(3),
        search.seed.candidateId,
        [searchedTask(search, 0), searchedTask(search, 1)],
        later(3),
        runIds,
      );
    };

    const causeInput = (search: Search, at: number, cause: string) => ({
      taskId: searchedTask(search, at).taskId,
      cause,
      evidence: `Task ${at} failed because of the ${cause}.`,
      suggestion: cause === 'config' ? null : `Fix the ${cause}.`,
    });

    const reflected = (search: Search): Search =>
      search
        .recordRunEnd(
          run(3),
          { failed: false, started: true },
          later(3),
          runIds,
        )
        .recordAgentSpend(run(3), NO_SPEND, later(3), runIds);

    let runIds = searchRunIds();

    const stalledAgain = (budget = aBudget({ iterations: 4 })): Search => {
      runIds = searchRunIds();
      return reflecting(budget);
    };

    it('looks only into the tasks it searched, once, before its run is queued', () => {
      const search = stalledAgain();
      const heldOut = search.split.heldOut[0];

      const at = (from: Search, tasks: readonly ReflectedTask[], on = run(3)) =>
        from.reflectingOn(on, from.seed.candidateId, tasks, later(3), runIds);

      expect(search.iterations[2]?.reflectedOn).toHaveLength(2);
      expect(search.iterations[2]?.incumbent).toEqual(search.seed.candidateId);
      expect(
        at(search, [searchedTask(search, 2)]).iterations[2]?.reflectedOn,
      ).toHaveLength(2);
      expect(() =>
        at(stalled(), [
          ReflectedTask.of({
            taskId: heldOut?.taskId as TaskId,
            originalRunId: heldOut?.runId as RunId,
            replayRunId: RunId.of('replayed_held_out'),
          }),
        ]),
      ).toThrow(InvalidSearchError);
      expect(() =>
        stalled().reflectingOn(
          run(3),
          CandidateId.of('candidate_stranger'),
          [searchedTask(search, 0)],
          later(3),
          runIds,
        ),
      ).toThrow(InvalidSearchError);
      expect(() => at(searching(), [searchedTask(search, 0)], run(1))).toThrow(
        InvalidSearchError,
      );
    });

    it('ends stalled without running when the best config so far fails none of the searched tasks', () => {
      runIds = searchRunIds();
      const stalledSearch = stalled(aBudget({ iterations: 4 }), runIds);

      stalledSearch.pullEvents();

      const ended = stalledSearch.reflectingOn(
        run(3),
        stalledSearch.seed.candidateId,
        [],
        later(3),
        runIds,
      );

      expect(ended.stopReason).toBe('stalled');
      expect(ended.activeRun).toBeNull();
      expect(ended.iterations[2]?.result).toBe('no-failures');
      expect(ended.iterations[2]?.endedSearch).toBe(true);
      expect(ended.pullEvents()).toContainEqual(expect.any(SearchEnded));
    });

    it('records one cause per task it looks into, the later replacing the earlier', () => {
      const search = stalledAgain();
      const recorded = search
        .recordCause(run(3), causeInput(search, 0, 'judge'), later(4))
        .recordCause(run(3), causeInput(search, 0, 'config'), later(5))
        .recordCause(run(3), causeInput(search, 1, 'task'), later(5));
      const causes = recorded.iterations[2]?.causes ?? [];

      expect(causes.map((each) => [each.taskId, each.cause])).toEqual([
        [searchedTask(search, 0).taskId, 'config'],
        [searchedTask(search, 1).taskId, 'task'],
      ]);
      expect(causes[1]).toMatchObject({
        originalRunId: searchedTask(search, 1).originalRunId,
        replayRunId: searchedTask(search, 1).replayRunId,
        evidence: 'Task 1 failed because of the task.',
        suggestion: 'Fix the task.',
      });
    });

    it('rejects a cause for a task it does not look into, held out or not, alike', () => {
      const search = stalledAgain();
      const heldOut = search.split.heldOut[0]?.taskId as TaskId;

      for (const taskId of [
        heldOut,
        searchedTask(search, 2).taskId,
        TaskId.of('task_unknown'),
      ]) {
        expect(() =>
          search.recordCause(
            run(3),
            { ...causeInput(search, 0, 'config'), taskId },
            later(4),
          ),
        ).toThrow(UnknownSearchTaskError);
      }
    });

    it('rejects a cause it cannot read, from an iteration that proposes, or once its run ended', () => {
      const search = stalledAgain();

      expect(() =>
        search.recordCause(
          run(3),
          { ...causeInput(search, 0, 'config'), cause: 'luck' },
          later(4),
        ),
      ).toThrow(InvalidFailureCauseError);
      expect(() =>
        search.recordCause(
          run(3),
          { ...causeInput(search, 0, 'config'), evidence: '  ' },
          later(4),
        ),
      ).toThrow(InvalidFailureCauseError);
      expect(() =>
        searching().recordCause(
          run(1),
          causeInput(search, 0, 'config'),
          later(4),
        ),
      ).toThrow(SearchNotReflectingError);
      expect(() =>
        search
          .recordRunEnd(
            run(3),
            { failed: false, started: true },
            later(3),
            runIds,
          )
          .recordCause(run(3), causeInput(search, 0, 'config'), later(4)),
      ).toThrow(SearchIterationClosedError);
    });

    it('takes no candidate while it looks into why it stalled', () => {
      expect(() =>
        stalledAgain().acceptProposal(run(3), proposal('late')),
      ).toThrow(SearchReflectingError);
    });

    it('searches on, its stall cleared, once it finds a cause the config can fix', () => {
      const search = stalledAgain(aBudget({ iterations: 7 }));
      const reflection = search
        .recordCause(run(3), causeInput(search, 0, 'config'), later(4))
        .recordCause(run(3), causeInput(search, 1, 'judge'), later(4));

      reflection.pullEvents();

      const goneOn = reflected(reflection);

      expect(goneOn.current).toBe('searching');
      expect(goneOn.iterations[3]?.kind).toBe('propose');
      expect(goneOn.iterations[2]?.result).toBe('continued');
      expect(goneOn.iterations[2]?.endedSearch).toBe(false);
      expect(goneOn.pullEvents()).toEqual([
        new SearchIterationRequested(SEARCH_ID, goneOn.workspaceId, 4, run(4)),
      ]);

      const once = goneOn
        .recordRunEnd(run(4), { failed: true, started: true }, later(5), runIds)
        .recordAgentSpend(run(4), NO_SPEND, later(5), runIds);

      expect(once.iterations[4]?.kind).toBe('propose');

      const twice = once
        .recordRunEnd(run(5), { failed: true, started: true }, later(6), runIds)
        .recordAgentSpend(run(5), NO_SPEND, later(6), runIds);

      expect(twice.iterations[5]?.kind).toBe('reflect');
    });

    it('ends stalled, keeping what is left of its budget, when nothing it found is for the config to fix', () => {
      for (const causes of [['task'], ['task', 'judge']]) {
        const search = stalledAgain(aBudget({ iterations: 6 }));
        const reflection = causes.reduce(
          (built, cause, at) =>
            built.recordCause(run(3), causeInput(search, at, cause), later(4)),
          search,
        );

        reflection.pullEvents();

        const ended = reflected(reflection);

        expect(ended.current).toBe('finished');
        expect(ended.stopReason).toBe('stalled');
        expect(ended.iterations).toHaveLength(3);
        expect(ended.iterations[2]?.result).toBe('no-config-cause');
        expect(ended.iterations[2]?.endedSearch).toBe(true);
        expect(ended.pullEvents()).toEqual([expect.any(SearchEnded)]);
      }
    });

    it('ends stalled when its run failed before it said anything', () => {
      const search = stalledAgain().recordRunEnd(
        run(3),
        { failed: true, started: false },
        later(3),
        runIds,
      );

      expect(search.stopReason).toBe('stalled');
      expect(search.iterations[2]?.result).toBe('did-not-run');
      expect(search.iterations[2]?.endedSearch).toBe(true);
    });

    it('holds out what it found before it stalled', () => {
      runIds = searchRunIds();
      const found = iterated(
        searching(aSearch({ budget: aBudget({ iterations: 6 }) }), runIds),
        1,
        ['good'],
        runIds,
      );
      const twice = [2, 3].reduce(
        (built, number) =>
          built
            .recordRunEnd(
              run(number),
              { failed: true, started: true },
              later(number),
              runIds,
            )
            .recordAgentSpend(run(number), NO_SPEND, later(number), runIds),
        found,
      );
      const ended = twice
        .recordRunEnd(
          run(4),
          { failed: false, started: true },
          later(4),
          runIds,
        )
        .recordAgentSpend(run(4), NO_SPEND, later(4), runIds);

      expect(twice.iterations[3]?.kind).toBe('reflect');
      expect(ended.current).toBe('holding-out');
      expect(ended.stopReason).toBe('stalled');
    });

    it('says it ended the search when it found a config cause but the budget left no room to try it', () => {
      const search = stalledAgain();
      const costly = search
        .recordCause(run(3), causeInput(search, 0, 'config'), later(4))
        .recordRunEnd(
          run(3),
          { failed: false, started: true },
          later(3),
          runIds,
        );
      const broke = costly.recordAgentSpend(
        run(3),
        ModelSpent.of([usd(99)], 0),
        later(4),
        runIds,
      );

      expect(costly.current).toBe('searching');
      expect(broke.stopReason).toBe('ceiling-reached');
      expect(broke.iterations[2]?.result).toBe('ceiling-reached');
      expect(broke.iterations[2]?.endedSearch).toBe(true);
    });

    it('rejects a stored iteration that both proposes and looks into tasks, or has a cause for a task it never looked into', () => {
      const search = stalledAgain();
      const recorded = search.recordCause(
        run(3),
        causeInput(search, 0, 'config'),
        later(4),
      );
      const reflection = recorded.iterations[2] as SearchIteration;
      const state = {
        number: 3,
        runId: run(3),
        state: 'running' as const,
        proposals: [],
        attempts: 0,
        agentSpent: null,
        incumbent: reflection.incumbent,
        result: null,
        reflectedOn: reflection.reflectedOn,
        causes: reflection.causes,
      };

      expect(
        SearchIteration.rehydrate({ ...state, kind: 'reflect' }).causes,
      ).toHaveLength(1);
      expect(() =>
        SearchIteration.rehydrate({ ...state, kind: 'propose' }),
      ).toThrow(InconsistentStateError);
      expect(() =>
        SearchIteration.rehydrate({
          ...state,
          kind: 'reflect',
          reflectedOn: [],
        }),
      ).toThrow(InconsistentStateError);
    });
  });

  const holdingOutFinished = (): Search => {
    const SET = aSet(10);
    const runIds = searchRunIds();
    const search = iterated(
      searching(
        aSearch({ budget: aBudget({ iterations: 1, perIteration: 2 }) }),
        runIds,
      ),
      1,
      ['one'],
      runIds,
    );
    let count = 0;

    return search
      .heldOutFrom(
        [
          replayedAs(
            replayFor(SET, 'replay_seed', 'candidate_live', null, true),
            () => 'completed',
            3,
          ),
          replayedAs(
            replayFor(
              SET,
              'replay_one',
              'candidate_one',
              search.split.searchedRuns,
            ),
            () => 'completed',
            1,
          ),
        ],
        0.05,
        () => ReplayId.of(`held_out_${++count}`),
        NOW,
      )
      .recordReplayStopReason(
        ReplayId.of('held_out_1'),
        'finished',
        charged(1),
        NOW,
        searchRunIds(),
        true,
      );
  };

  describe('holding out', () => {
    const SET = aSet(10);

    const holdingOut = (
      rounds: readonly (readonly string[])[] = [['one', 'two']],
      objective: SearchObjective = 'success',
      perIteration = 2,
    ): Search => {
      const runIds = searchRunIds();
      let search = searching(
        aSearch({
          budget: aBudget({ iterations: rounds.length, perIteration }),
          objective,
        }),
        runIds,
      );

      for (const [place, names] of rounds.entries()) {
        search = iterated(search, place + 1, names, runIds);
      }
      search.pullEvents();

      return search;
    };

    const seedRan = () =>
      replayedAs(
        replayFor(SET, 'replay_seed', 'candidate_live', null, true),
        () => 'completed',
        3,
      );

    const candidateRan = (
      search: Search,
      name: string,
      cost: number,
      failing = 0,
    ) => {
      const failed = new Set(
        search.split.searchedRuns.slice(0, failing).map((each) => each.value),
      );

      return replayedAs(
        replayFor(
          SET,
          `replay_${name}`,
          `candidate_${name}`,
          search.split.searchedRuns,
        ),
        (original) => (failed.has(original) ? 'failed' : 'completed'),
        cost,
      );
    };

    const heldOutIds = () => {
      let count = 0;

      return () => ReplayId.of(`held_out_${++count}`);
    };

    it('holds out only the candidates on the frontier, then finishes once their held-out replays ended', () => {
      const search = holdingOut();
      const heldOutSearch = search.heldOutFrom(
        [
          seedRan(),
          candidateRan(search, 'one', 1),
          candidateRan(search, 'two', 2),
        ],
        0.05,
        heldOutIds(),
        later(2),
      );

      expect(heldOutSearch.current).toBe('holding-out');
      expect(
        heldOutSearch.heldOut.map((each) => [
          each.candidateId.value,
          each.replay.replayId.value,
        ]),
      ).toEqual([['candidate_one', 'held_out_1']]);

      const finished = heldOutSearch.recordReplayStopReason(
        ReplayId.of('held_out_1'),
        'finished',
        charged(1),
        later(3),
        searchRunIds(),
        true,
      );

      expect(finished.current).toBe('finished');
      expect(finished.stopReason).toBe('iterations-spent');
      expect(finished.endedAt).toEqual(later(3));
      expect(finished.pullEvents()).toEqual([
        new SearchEnded(
          SEARCH_ID,
          finished.workspaceId,
          'finished',
          'iterations-spent',
          null,
          [],
        ),
      ]);
    });

    it('holds out at most its per-iteration number, the best searched first', () => {
      const search = holdingOut([['best', 'good'], ['cheap']]);
      const heldOutSearch = search.heldOutFrom(
        [
          seedRan(),
          candidateRan(search, 'best', 3),
          candidateRan(search, 'good', 2, 1),
          candidateRan(search, 'cheap', 1, 2),
        ],
        0.05,
        heldOutIds(),
        NOW,
      );

      expect(
        heldOutSearch.heldOut.map((each) => each.candidateId.value),
      ).toEqual(['candidate_best', 'candidate_good']);
    });

    it('holds out, when it looks for cost, only candidates cheaper than the seed that succeed as often as it, leaving out those clearly worse', () => {
      const ran = (search: Search) => [
        seedRan(),
        candidateRan(search, 'best', 3),
        candidateRan(search, 'cheapworse', 0.5, 5),
        candidateRan(search, 'cheap', 1, 1),
      ];
      const heldOutOf = (objective: SearchObjective) => {
        const search = holdingOut(
          [['best', 'cheapworse', 'cheap']],
          objective,
          3,
        );

        return search
          .heldOutFrom(ran(search), 0.05, heldOutIds(), NOW)
          .heldOut.map((each) => each.candidateId.value);
      };

      expect(heldOutOf('cost')).toEqual(['candidate_cheap']);
      expect(heldOutOf('success')).toEqual([
        'candidate_best',
        'candidate_cheap',
        'candidate_cheapworse',
      ]);
    });

    it('finishes at once when no candidate beat the seed anywhere', () => {
      const search = holdingOut([['worse']]);

      expect(
        search.heldOutFrom(
          [seedRan(), candidateRan(search, 'worse', 5, 3)],
          0.05,
          heldOutIds(),
          NOW,
        ).current,
      ).toBe('finished');
    });

    it('holds out once, and only after it stopped searching', () => {
      const search = holdingOut();
      const replays = [
        seedRan(),
        candidateRan(search, 'one', 1),
        candidateRan(search, 'two', 2),
      ];

      expect(() =>
        search
          .heldOutFrom(replays, 0.05, heldOutIds(), NOW)
          .heldOutFrom(replays, 0.05, heldOutIds(), NOW),
      ).toThrow(InvalidSearchError);
      expect(() =>
        searching().heldOutFrom(replays, 0.05, heldOutIds(), NOW),
      ).toThrow(InvalidSearchError);
    });

    it('finishes once its held-out replays end', () => {
      expect(holdingOutFinished().current).toBe('finished');
    });

    it('takes what a held-out replay spent after it ended', () => {
      const search = holdingOut()
        .heldOutFrom(
          [seedRan(), candidateRan(holdingOut(), 'one', 1)],
          0.05,
          heldOutIds(),
          NOW,
        )
        .recordReplayStopReason(
          ReplayId.of('held_out_1'),
          'stopped',
          charged(1),
          NOW,
          searchRunIds(),
          true,
        );
      const grown = search.replaySpent(ReplayId.of('held_out_1'), charged(1.5));

      expect(grown.heldOut[0]?.replay.spent?.amount).toBe(1.5);
      expect(grown.replaySpent(ReplayId.of('held_out_1'), charged(1.2))).toBe(
        grown,
      );
    });
  });

  describe('picking', () => {
    it('records one pick once it finished: a candidate it proposed, or why it declined', () => {
      const finished = holdingOutFinished();

      expect(finished.current).toBe('finished');
      finished.pullEvents();

      const picked = finished.picked({
        outcome: 'picked',
        candidateId: CandidateId.of('candidate_one'),
      });

      expect(picked.pick).toEqual({
        outcome: 'picked',
        candidateId: CandidateId.of('candidate_one'),
      });
      expect(picked.pullEvents()).toEqual([
        new SearchCandidatePicked(
          SEARCH_ID,
          picked.workspaceId,
          CandidateId.of('candidate_one'),
        ),
      ]);
      expect(
        finished
          .picked({ outcome: 'declined', reason: 'likely-overfit' })
          .pullEvents(),
      ).toEqual([
        new SearchPickDeclined(SEARCH_ID, picked.workspaceId, 'likely-overfit'),
      ]);
      expect(() =>
        picked.picked({ outcome: 'declined', reason: 'no-candidate' }),
      ).toThrow(InvalidSearchError);
      expect(() =>
        finished.picked({
          outcome: 'picked',
          candidateId: CandidateId.of('candidate_none'),
        }),
      ).toThrow(InvalidSearchError);
      expect(() =>
        searching().picked({ outcome: 'declined', reason: 'no-candidate' }),
      ).toThrow(InvalidSearchError);
    });

    it('withdraws a pick it made, saying why, and nothing else', () => {
      const finished = holdingOutFinished();
      const picked = finished.picked({
        outcome: 'picked',
        candidateId: CandidateId.of('candidate_one'),
      });

      picked.pullEvents();

      const withdrawn = picked.pickWithdrawn('pull-request-open');

      expect(withdrawn.pick).toEqual({
        outcome: 'declined',
        reason: 'pull-request-open',
      });
      expect(withdrawn.pullEvents()).toEqual([
        new SearchPickDeclined(
          SEARCH_ID,
          picked.workspaceId,
          'pull-request-open',
        ),
      ]);
      expect(() => withdrawn.pickWithdrawn('pull-request-open')).toThrow(
        InvalidSearchError,
      );
    });
  });

  describe('ending early', () => {
    it('stops when it is turned off, cancels its run and stops its replays in progress', () => {
      const search = proposing(searching(), 1, ['one']);
      const stopped = search.turnOff(later(5));

      expect(stopped.current).toBe('stopped');
      expect(stopped.stopReason).toBe('turned-off');
      expect(stopped.isActive).toBe(false);
      expect(stopped.endedAt).toEqual(later(5));
      expect(stopped.pullEvents()).toEqual([
        new SearchEnded(
          SEARCH_ID,
          stopped.workspaceId,
          'stopped',
          'turned-off',
          run(1),
          [ReplayId.of('replay_one')],
        ),
      ]);
    });

    it('stops its seed replay when turned off while seeding', () => {
      const stopped = aSearch().turnOff(NOW);

      expect((stopped.pullEvents()[0] as SearchEnded).stopping).toEqual([SEED]);
    });

    it('changes nothing once it ended', () => {
      const stopped = searching().turnOff(NOW);

      expect(stopped.turnOff(later(1))).toBe(stopped);
    });

    it('ends when its station is gone, once', () => {
      const gone = searching().stationLeft(NOW);

      expect(gone.stopReason).toBe('station-gone');
      expect(gone.stationLeft(later(1))).toBe(gone);
    });

    it('takes no more candidates once ended, though word of its replays still arrives', () => {
      const runIds = searchRunIds();
      const stopped = proposing(searching(aSearch(), runIds), 1, [
        'one',
      ]).turnOff(NOW);

      expect(() => stopped.acceptProposal(run(1), proposal('two'))).toThrow(
        SearchIterationClosedError,
      );

      const noted = endingReplays(stopped, ['one'], 'stopped', runIds)
        .recordRunEnd(
          run(1),
          { failed: false, started: true },
          later(1),
          runIds,
        )
        .recordAgentSpend(run(1), NO_SPEND, later(1), runIds);

      expect(noted.current).toBe('stopped');
      expect(noted.iterations).toHaveLength(1);
      expect(noted.spent.amount).toBe(6);
    });

    it('is deleted with its team', () => {
      expect(searching().delete().isDeleted).toBe(true);
    });
  });

  it('rejects a stored search whose iterations skip a number, or that held out before it stopped searching', () => {
    const runIds = searchRunIds();
    const search = iterated(searching(aSearch(), runIds), 1, ['one'], runIds);
    const state = {
      id: search.id,
      station: search.station,
      setId: search.setId,
      agent: search.agent,
      budget: search.budget,
      objective: search.objective,
      split: search.split,
      calibrates: false,
      seed: search.seed,
      state: 'searching' as const,
      stopReason: null,
      trigger: 'schedule' as const,
      pick: null,
      startedAt: NOW,
      endedAt: null,
      version: 1,
    };

    expect(() =>
      Search.rehydrate({
        ...state,
        iterations: search.iterations.slice(1),
        heldOut: [],
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      Search.rehydrate({
        ...state,
        iterations: search.iterations,
        heldOut: [
          {
            candidateId: CandidateId.of('candidate_one'),
            replay: search.seed.replay,
          },
        ],
      }),
    ).toThrow(InconsistentStateError);
    expect(
      Search.rehydrate({ ...state, iterations: search.iterations, heldOut: [] })
        .iterations,
    ).toHaveLength(2);
  });

  it('rejects a stored search whose end and state disagree', () => {
    const search = searching();

    expect(() =>
      Search.rehydrate({
        id: search.id,
        station: search.station,
        setId: search.setId,
        agent: search.agent,
        budget: search.budget,
        objective: search.objective,
        split: search.split,
        calibrates: false,
        seed: search.seed,
        iterations: search.iterations,
        heldOut: [],
        state: 'finished',
        stopReason: 'stalled',
        trigger: 'schedule' as const,
        pick: null,
        startedAt: NOW,
        endedAt: null,
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      Search.rehydrate({
        id: search.id,
        station: search.station,
        setId: search.setId,
        agent: search.agent,
        budget: search.budget,
        objective: search.objective,
        split: search.split,
        calibrates: false,
        seed: search.seed,
        iterations: search.iterations,
        heldOut: [],
        state: 'searching',
        stopReason: 'stalled',
        trigger: 'schedule' as const,
        pick: null,
        startedAt: NOW,
        endedAt: null,
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });
});
