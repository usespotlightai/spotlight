import { Search } from '@replays/domain/aggregates/search.aggregate';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchHoldingOutWanted } from '@replays/domain/events/search-holding-out-wanted.event';
import { SearchIterationWanted } from '@replays/domain/events/search-iteration-wanted.event';
import { SearchStarted } from '@replays/domain/events/search-started.event';
import { SearchStopAsked } from '@replays/domain/events/search-stop-asked.event';
import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';
import { ReplaySetStationGoneError } from '@replays/domain/exceptions/replay-set-station-gone.error';
import { SearchCandidateNameTakenError } from '@replays/domain/exceptions/search-candidate-name-taken.error';
import { SearchEndedError } from '@replays/domain/exceptions/search-ended.error';
import { SearchIterationClosedError } from '@replays/domain/exceptions/search-iteration-closed.error';
import { SearchProposalsSpentError } from '@replays/domain/exceptions/search-proposals-spent.error';
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
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayEnd } from '@replays/domain/value-objects/replay-state';
import { ATTEMPTS_PER_PROPOSAL } from '@replays/domain/value-objects/search-iteration.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const SEED = ReplayId.of('replay_seed');

const usd = (amount: number) => Spend.of(amount, 'USD');

const charged = (amount: number, unpriced = 0) => ({
  spent: usd(amount),
  unpriced,
});

const NO_SPEND = ModelSpent.of([], 0);

const run = (number: number) => RunId.of(`search_run_${number}`);

const searching = (search = aSearch(), runIds = searchRunIds()): Search => {
  const seeded = search.replayEnded(SEED, 'finished', charged(5), NOW, runIds);

  seeded.pullEvents();

  return seeded;
};

const admission = (name: string, replay = `replay_${name}`) => ({
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
    (held, name) => held.admitted(run(number), admission(name)),
    search,
  );

const endingReplays = (
  search: Search,
  names: readonly string[],
  end: ReplayEnd,
  runIds: () => RunId,
  spent = 1,
): Search =>
  names.reduce(
    (held, name) =>
      held.replayEnded(
        ReplayId.of(`replay_${name}`),
        end,
        charged(spent),
        later(1),
        runIds,
      ),
    search,
  );

const iterated = (
  search: Search,
  number: number,
  names: readonly string[],
  runIds: () => RunId,
  end: ReplayEnd = 'finished',
): Search =>
  endingReplays(
    proposing(search, number, names)
      .runEnded(run(number), { failed: false, started: true }, later(1), runIds)
      .spentByAgent(run(number), NO_SPEND, later(1), runIds),
    names,
    end,
    runIds,
  );

describe('Search', () => {
  describe('starting', () => {
    it('seeds itself from the live config, saying who started it, with what budget', () => {
      const set = aSet(10);
      const split = HeldOutSplit.drawn({
        searchId: SEARCH_ID,
        entries: set.entries,
        digest: sha256,
      });
      const started = Search.started({
        id: SEARCH_ID,
        set,
        agent: AGENT,
        budget: aBudget(),
        split,
        seed: { candidate: candidateOf('live'), replayId: SEED },
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
      const started = Search.started({
        id: SEARCH_ID,
        set,
        agent: AGENT,
        budget: aBudget({ iterations: 4, perIteration: 3, concurrency: 6 }),
        split: HeldOutSplit.drawn({
          searchId: SEARCH_ID,
          entries: set.entries,
          digest: sha256,
        }),
        seed: { candidate: candidateOf('live'), replayId: SEED },
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
      });
    });

    it('splits exactly the runs of its set', () => {
      const set = aSet(10);

      expect(() =>
        Search.started({
          id: SEARCH_ID,
          set,
          agent: AGENT,
          budget: aBudget(),
          split: HeldOutSplit.drawn({
            searchId: SEARCH_ID,
            entries: aSet(9).entries,
            digest: sha256,
          }),
          seed: { candidate: candidateOf('live'), replayId: SEED },
          at: NOW,
          by: BY,
        }),
      ).toThrow(InvalidSearchError);
    });

    it('starts only from the live config', () => {
      const set = aSet(10);

      expect(() =>
        Search.started({
          id: SEARCH_ID,
          set,
          agent: AGENT,
          budget: aBudget(),
          split: HeldOutSplit.drawn({
            searchId: SEARCH_ID,
            entries: set.entries,
            digest: sha256,
          }),
          seed: { candidate: candidateOf('proposed'), replayId: SEED },
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

    it('refuses a budget too thin to give each replay a cent', () => {
      expect(() =>
        aSearch({
          budget: aBudget({ iterations: 10, perIteration: 5, ceiling: 0.2 }),
        }),
      ).toThrow(InvalidSearchError);
    });
  });

  describe('seeding', () => {
    it('wants its first iteration once its seed replay finished', () => {
      const runIds = searchRunIds();
      const seeded = aSearch().replayEnded(
        SEED,
        'finished',
        charged(5),
        NOW,
        runIds,
      );

      expect(seeded.current).toBe('searching');
      expect(seeded.heldRun).toEqual(run(1));
      expect(seeded.iterations.map((each) => each.current)).toEqual(['wanted']);
      expect(seeded.spent.amount).toBe(5);
      expect(seeded.pullEvents()).toEqual([
        new SearchIterationWanted(SEARCH_ID, seeded.workspaceId, 1, run(1)),
      ]);
    });

    it('ends, its ceiling reached, when its seed replay went over budget', () => {
      const over = aSearch().replayEnded(
        SEED,
        'over-budget',
        charged(50),
        NOW,
        searchRunIds(),
      );

      expect(over.current).toBe('finished');
      expect(over.ending).toBe('ceiling-reached');
      expect(over.iterations).toEqual([]);
    });

    it.each(['stopped', 'abandoned'] as const)(
      'ends, its seed failed, when its seed replay ended %s',
      (end) => {
        const failed = aSearch().replayEnded(
          SEED,
          end,
          charged(5),
          NOW,
          searchRunIds(),
        );

        expect(failed.current).toBe('stopped');
        expect(failed.ending).toBe('seed-failed');
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
      expect(() => aSearch().admitted(run(1), admission('terse'))).toThrow(
        SearchIterationClosedError,
      );
    });
  });

  describe('proposing', () => {
    it('admits a candidate from the run it holds', () => {
      const admitted = searching().admitted(run(1), admission('terse'));

      expect(admitted.proposals.map((each) => each.name.value)).toEqual([
        'terse',
      ]);
      expect(admitted.pullEvents()).toEqual([]);
    });

    it('takes at most its per-iteration number of candidates from one run', () => {
      const full = proposing(searching(), 1, ['one', 'two']);

      expect(() => full.admitted(run(1), admission('three'))).toThrow(
        SearchProposalsSpentError,
      );
    });

    it(`stops taking proposals from a run that tried ${ATTEMPTS_PER_PROPOSAL} times its number`, () => {
      let search = searching();

      for (let tried = 0; tried < 2 * ATTEMPTS_PER_PROPOSAL; tried += 1) {
        search = search.proposalRefused(run(1));
      }

      expect(search.iterations[0]?.attempts).toBe(6);
      expect(() => search.admitted(run(1), admission('late'))).toThrow(
        SearchProposalsSpentError,
      );
      expect(() => search.proposalRefused(run(1))).toThrow(
        SearchProposalsSpentError,
      );
    });

    it('takes no candidate once its run ended, nor from a run it never held', () => {
      const ended = searching()
        .runEnded(
          run(1),
          { failed: false, started: true },
          later(1),
          searchRunIds(),
        )
        .spentByAgent(run(1), NO_SPEND, later(1), searchRunIds());

      expect(() => ended.admitted(run(1), admission('late'))).toThrow(
        SearchIterationClosedError,
      );
      expect(() => searching().admitted(run(9), admission('other'))).toThrow(
        SearchIterationClosedError,
      );
    });

    it('refuses a name it took already, in any iteration', () => {
      const runIds = searchRunIds();
      const first = iterated(
        searching(aSearch(), runIds),
        1,
        ['terse'],
        runIds,
      );

      expect(first.heldRun).toEqual(run(2));
      expect(() =>
        first.admitted(run(2), admission('terse', 'replay_x')),
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
        .runEnded(run(1), { failed: false, started: true }, later(1), runIds)
        .spentByAgent(run(1), NO_SPEND, later(1), runIds);

      expect(runOver.iterations).toHaveLength(1);

      const oneLeft = endingReplays(runOver, ['one'], 'finished', runIds);

      expect(oneLeft.iterations).toHaveLength(1);

      const next = endingReplays(oneLeft, ['two'], 'over-budget', runIds);

      expect(next.iterations.map((each) => each.current)).toEqual([
        'ended',
        'wanted',
      ]);
      expect(next.pullEvents().slice(-1)[0]).toEqual(
        new SearchIterationWanted(SEARCH_ID, next.workspaceId, 2, run(2)),
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
      expect(seeded.replayEnded(SEED, 'stopped', charged(1), NOW, runIds)).toBe(
        seeded,
      );
    });

    it('takes what a replay spent after it ended, only ever more, and counts it toward the next iteration', () => {
      const runIds = searchRunIds();
      const seeded = searching(aSearch(), runIds);
      const grown = seeded.replaySpent(SEED, charged(7));

      expect(grown.seed.replay.spent?.amount).toBe(7);
      expect(grown.spent.amount).toBe(7);
      expect(grown.replaySpent(SEED, charged(6))).toBe(grown);
      expect(
        grown.replaySpent(SEED, { spent: Spend.of(9, 'EUR'), unpriced: 0 }),
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
      const ended = searching(aSearch(), runIds).runEnded(
        run(1),
        { failed: false, started: true },
        later(1),
        runIds,
      );

      expect(ended.heldRun).toBeNull();
      expect(ended.awaitingAgentSpend.map((each) => each.number)).toEqual([1]);

      const spent = ended.spentByAgent(
        run(1),
        ModelSpent.of([usd(2)], 0),
        later(2),
        runIds,
      );

      expect(spent.heldRun).toEqual(run(2));
      expect(spent.spent.amount).toBe(7);
      expect(
        spent.spentByAgent(run(1), ModelSpent.of([usd(9)], 0), later(3), runIds)
          .spent.amount,
      ).toBe(7);
    });

    it('closes an iteration whose run never started without waiting for a spend', () => {
      const runIds = searchRunIds();
      const withdrawn = searching(aSearch(), runIds).runEnded(
        run(1),
        { failed: true, started: false },
        later(1),
        runIds,
      );

      expect(withdrawn.heldRun).toEqual(run(2));
      expect(withdrawn.iterations[0]?.agentSpent?.unpriced).toBe(0);
    });

    it('charges an unpriced or foreign agent run its whole allotment, and searches on while that fits', () => {
      for (const spent of [
        ModelSpent.of([usd(0.1)], 1),
        ModelSpent.of([Spend.of(0.1, 'EUR')], 0),
      ]) {
        const runIds = searchRunIds();
        const seeded = searching(
          aSearch({ budget: aBudget({ iterations: 5 }) }),
          runIds,
        );
        const search = endingReplays(
          proposing(seeded, 1, ['one'])
            .runEnded(
              run(1),
              { failed: false, started: true },
              later(1),
              runIds,
            )
            .spentByAgent(run(1), spent, later(1), runIds),
          ['one'],
          'finished',
          runIds,
        );

        expect(
          search.spent.equals(usd(6).plus(seeded.allotment.agentRun)),
        ).toBe(true);
        expect(search.current).toBe('searching');
        expect(search.heldRun).toEqual(run(2));
      }
    });

    it('charges each unpriced or foreign run of a replay its share per run', () => {
      const seeded = aSearch().replayEnded(
        SEED,
        'finished',
        charged(5, 3),
        NOW,
        searchRunIds(),
      );

      expect(
        seeded.spent.equals(usd(5).plus(seeded.allotment.perRun.scaled(3, 1))),
      ).toBe(true);
      expect(seeded.replaySpent(SEED, charged(5, 2))).toBe(seeded);
      expect(seeded.replaySpent(SEED, charged(5, 4)).seed.replay.unpriced).toBe(
        4,
      );
    });

    it('takes word that Work queued its run, and what its agent spent', () => {
      const runIds = searchRunIds();
      const search = searching(aSearch(), runIds)
        .runQueued(run(1))
        .spentByAgent(
          run(1),
          ModelSpent.of([usd(2), Spend.of(1, 'EUR')], 0),
          later(1),
          runIds,
        );

      expect(search.iterations[0]?.current).toBe('running');
      expect(search.spent.amount).toBe(5 + search.allotment.agentRun.amount);
    });

    it('stalls after two iterations in a row that came to nothing', () => {
      const runIds = searchRunIds();
      const failed = searching(aSearch(), runIds)
        .runEnded(run(1), { failed: true, started: true }, later(1), runIds)
        .spentByAgent(run(1), NO_SPEND, later(1), runIds);
      const empty = failed
        .runEnded(run(2), { failed: false, started: true }, later(2), runIds)
        .spentByAgent(run(2), NO_SPEND, later(2), runIds);

      expect(failed.current).toBe('searching');
      expect(empty.current).toBe('finished');
      expect(empty.ending).toBe('stalled');
    });

    it('keeps going after one iteration that came to nothing, when the next finds something', () => {
      const runIds = searchRunIds();
      const search = iterated(
        searching(aSearch({ budget: aBudget({ iterations: 5 }) }), runIds)
          .runEnded(run(1), { failed: true, started: true }, later(1), runIds)
          .spentByAgent(run(1), NO_SPEND, later(1), runIds),
        2,
        ['good'],
        runIds,
      )
        .runEnded(run(3), { failed: false, started: true }, later(3), runIds)
        .spentByAgent(run(3), NO_SPEND, later(3), runIds);

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
      expect(search.ending).toBe('iterations-spent');
      expect(search.endedAt).toBeNull();
      expect(search.pullEvents()).toEqual([
        new SearchHoldingOutWanted(SEARCH_ID, search.workspaceId),
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
      expect(search.ending).toBe('iterations-spent');
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
          .runEnded(run(1), { failed: false, started: true }, later(1), runIds)
          .spentByAgent(run(1), NO_SPEND, later(1), runIds),
        ['costly'],
        'finished',
        runIds,
        12,
      );

      expect(search.current).toBe('holding-out');
      expect(search.ending).toBe('ceiling-reached');
    });
  });

  describe('holding out', () => {
    const SET = aSet(10);

    const holdingOut = (
      rounds: readonly (readonly string[])[] = [['one', 'two']],
    ): Search => {
      const runIds = searchRunIds();
      let search = searching(
        aSearch({ budget: aBudget({ iterations: rounds.length }) }),
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

    const heldIds = () => {
      let held = 0;

      return () => ReplayId.of(`held_${++held}`);
    };

    it('holds out only the candidates on the frontier, then finishes once their held-out replays ended', () => {
      const search = holdingOut();
      const held = search.heldOutFrom(
        [
          seedRan(),
          candidateRan(search, 'one', 1),
          candidateRan(search, 'two', 2),
        ],
        heldIds(),
        later(2),
      );

      expect(held.current).toBe('holding-out');
      expect(
        held.heldOut.map((each) => [
          each.candidateId.value,
          each.replay.replayId.value,
        ]),
      ).toEqual([['candidate_one', 'held_1']]);

      const finished = held.replayEnded(
        ReplayId.of('held_1'),
        'finished',
        charged(1),
        later(3),
        searchRunIds(),
      );

      expect(finished.current).toBe('finished');
      expect(finished.ending).toBe('iterations-spent');
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
      const held = search.heldOutFrom(
        [
          seedRan(),
          candidateRan(search, 'best', 3),
          candidateRan(search, 'good', 2, 1),
          candidateRan(search, 'cheap', 1, 2),
        ],
        heldIds(),
        NOW,
      );

      expect(held.heldOut.map((each) => each.candidateId.value)).toEqual([
        'candidate_best',
        'candidate_good',
      ]);
    });

    it('finishes at once when no candidate beat the seed anywhere', () => {
      const search = holdingOut([['worse']]);

      expect(
        search.heldOutFrom(
          [seedRan(), candidateRan(search, 'worse', 5, 3)],
          heldIds(),
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
          .heldOutFrom(replays, heldIds(), NOW)
          .heldOutFrom(replays, heldIds(), NOW),
      ).toThrow(InvalidSearchError);
      expect(() => searching().heldOutFrom(replays, heldIds(), NOW)).toThrow(
        InvalidSearchError,
      );
    });

    it('takes what a held-out replay spent after it ended', () => {
      const search = holdingOut()
        .heldOutFrom(
          [seedRan(), candidateRan(holdingOut(), 'one', 1)],
          heldIds(),
          NOW,
        )
        .replayEnded(
          ReplayId.of('held_1'),
          'stopped',
          charged(1),
          NOW,
          searchRunIds(),
        );
      const grown = search.replaySpent(ReplayId.of('held_1'), charged(1.5));

      expect(grown.heldOut[0]?.replay.spent?.amount).toBe(1.5);
      expect(grown.replaySpent(ReplayId.of('held_1'), charged(1.2))).toBe(
        grown,
      );
    });
  });

  describe('ending early', () => {
    it('stops on request, withdrawing its run and stopping its replays underway', () => {
      const search = proposing(searching(), 1, ['one']);
      const stopped = search.stopped(later(5), BY);

      expect(stopped.current).toBe('stopped');
      expect(stopped.ending).toBe('stopped');
      expect(stopped.isActive).toBe(false);
      expect(stopped.endedAt).toEqual(later(5));
      expect(stopped.pullEvents()).toEqual([
        new SearchEnded(
          SEARCH_ID,
          stopped.workspaceId,
          'stopped',
          'stopped',
          run(1),
          [ReplayId.of('replay_one')],
        ),
        new SearchStopAsked(
          SEARCH_ID,
          stopped.teamId,
          ConfigurationChange.updated(
            {
              resource: 'replay-search',
              id: SEARCH_ID.value,
              key: SEARCH_ID.value,
            },
            BY,
          ),
        ),
      ]);
    });

    it('stops its seed replay when stopped while seeding', () => {
      const stopped = aSearch().stopped(NOW, BY);

      expect((stopped.pullEvents()[0] as SearchEnded).stopping).toEqual([SEED]);
    });

    it('cannot be stopped once it ended', () => {
      const stopped = searching().stopped(NOW, BY);

      expect(() => stopped.stopped(NOW, BY)).toThrow(SearchEndedError);
    });

    it('ends when its station or its set is gone, once', () => {
      const gone = searching().stationLeft(NOW);
      const setGone = searching().setGone(NOW);

      expect(gone.ending).toBe('station-gone');
      expect(setGone.ending).toBe('set-gone');
      expect(gone.stationLeft(later(1))).toBe(gone);
      expect(gone.setGone(later(1))).toBe(gone);
    });

    it('takes no more candidates once ended, though word of its replays still arrives', () => {
      const runIds = searchRunIds();
      const stopped = proposing(searching(aSearch(), runIds), 1, [
        'one',
      ]).stopped(NOW, BY);

      expect(() => stopped.admitted(run(1), admission('two'))).toThrow(
        SearchIterationClosedError,
      );

      const noted = endingReplays(stopped, ['one'], 'stopped', runIds)
        .runEnded(run(1), { failed: false, started: true }, later(1), runIds)
        .spentByAgent(run(1), NO_SPEND, later(1), runIds);

      expect(noted.current).toBe('stopped');
      expect(noted.iterations).toHaveLength(1);
      expect(noted.spent.amount).toBe(6);
    });

    it('is abandoned with its team', () => {
      expect(searching().abandoned().isAbandoned).toBe(true);
    });
  });

  it('refuses a stored search whose iterations skip a number, or that held out before it stopped searching', () => {
    const runIds = searchRunIds();
    const search = iterated(searching(aSearch(), runIds), 1, ['one'], runIds);
    const state = {
      id: search.id,
      station: search.station,
      setId: search.setId,
      agent: search.agent,
      budget: search.budget,
      split: search.split,
      seed: search.seed,
      state: 'searching' as const,
      ending: null,
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

  it('refuses a stored search whose end and state disagree', () => {
    const search = searching();

    expect(() =>
      Search.rehydrate({
        id: search.id,
        station: search.station,
        setId: search.setId,
        agent: search.agent,
        budget: search.budget,
        split: search.split,
        seed: search.seed,
        iterations: search.iterations,
        heldOut: [],
        state: 'finished',
        ending: 'stalled',
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
        split: search.split,
        seed: search.seed,
        iterations: search.iterations,
        heldOut: [],
        state: 'searching',
        ending: 'stalled',
        startedAt: NOW,
        endedAt: null,
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });
});
