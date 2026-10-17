import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  aBudget,
  aSearch,
  aSet,
  BY,
  candidateOf,
  endOf,
  FINGERPRINT,
  later,
  measuresOf,
  NOW,
} from '@replays/domain/replays.fake-spec';
import { chargeOf } from '@replays/domain/services/replay-charge';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayEnd } from '@replays/domain/value-objects/replay-state';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const PASSED = ChangeChecks.of([
  {
    repository: 'api',
    state: 'passed',
    skip: null,
    failedAt: [],
    spent: ModelSpent.of([], 0),
  },
]);

const SET = aSet(10);

const SEED = 'replay_seed';

let next = 0;

const ids = (prefix: string) => () => RunId.of(`${prefix}_${next++}`);

type Pricing = (place: number) => number | null;

const replayed = (
  replay: Replay,
  concurrency: number,
  priced: Pricing,
): Replay => {
  let current = replay;
  let place = 0;

  while (current.hasWaiting) {
    current = current.reserving(concurrency, ids('replay_run'));

    for (const entry of current.occupying) {
      const run = entry.run as RunId;
      const cost = priced(place++);

      current = current
        .confirm(run, FINGERPRINT, NOW)
        .recordRunEnd(run, endOf('completed'))
        .recordReview(run, PASSED, null, later(1))
        .measure(run, measuresOf(cost), later(2));
    }
  }

  return current;
};

const started = (
  search: Search,
  id: string,
  candidate: string,
  ceiling: Spend,
  among?: readonly RunId[],
): Replay =>
  Replay.start({
    id: ReplayId.of(id),
    set: SET,
    candidate: candidateOf(id === SEED ? 'live' : 'proposed', candidate),
    baseline: id === SEED,
    ceiling,
    unpricedRate: search.allotment.perRun,
    at: NOW,
    by: BY,
    searchId: search.id,
    ...(among ? { among } : {}),
  });

const ended = (replay: Replay): ReplayEnd => {
  expect(replay.isDispatching).toBe(false);

  return replay.current as ReplayEnd;
};

const searched = (
  budget: ReturnType<typeof aBudget>,
  priced: Pricing,
  agentSpend: (iteration: number) => ModelSpent,
): Search => {
  const runIds = ids('search_run');
  let search = aSearch({ set: SET, budget });
  const seed = replayed(
    started(search, SEED, 'candidate_live', search.allotment.seed),
    budget.concurrency,
    priced,
  );
  const replays = [seed];

  search = search.recordReplayEnd(
    seed.id,
    ended(seed),
    chargeOf(seed),
    later(3),
    runIds,
    true,
  );

  while (search.wantedIteration) {
    const iteration = search.wantedIteration;
    const run = iteration.runId;
    const proposed: Replay[] = [];

    search = search.queueRun(run);
    for (let each = 0; each < budget.perIteration; each += 1) {
      const name = `c${iteration.number}-${each}`;
      const replay = started(
        search,
        `replay_${name}`,
        `candidate_${name}`,
        search.allotment.searchReplay,
        search.split.searchedRuns,
      );

      search = search.admitted(run, {
        candidateId: CandidateId.of(`candidate_${name}`),
        name: CandidateName.searched(name),
        replayId: replay.id,
      });
      proposed.push(replayed(replay, budget.concurrency, priced));
    }
    search = search
      .recordRunEnd(run, { failed: false, started: true }, later(4), runIds)
      .recordAgentSpend(run, agentSpend(iteration.number), later(4), runIds);
    for (const replay of proposed) {
      replays.push(replay);
      search = search.recordReplayEnd(
        replay.id,
        ended(replay),
        chargeOf(replay),
        later(5),
        runIds,
        true,
      );
    }
  }

  if (search.wantsHoldingOut) {
    search = search.heldOutFrom(
      replays,
      0.05,
      () => ReplayId.of(`held_out_${next++}`),
      later(6),
    );
    for (const heldOut of search.heldOut) {
      const replay = replayed(
        started(
          search,
          heldOut.replay.replayId.value,
          heldOut.candidateId.value,
          search.allotment.heldOutReplay,
          search.split.heldOutRuns,
        ),
        budget.concurrency,
        priced,
      );

      search = search.recordReplayEnd(
        replay.id,
        ended(replay),
        chargeOf(replay),
        later(7),
        runIds,
        true,
      );
    }
  }

  return search;
};

const BUDGETS = [
  aBudget({ iterations: 1, perIteration: 1, ceiling: 5 }),
  aBudget({ iterations: 3, perIteration: 2, ceiling: 20, concurrency: 2 }),
  aBudget({ iterations: 5, perIteration: 3, ceiling: 40, concurrency: 10 }),
  aBudget({ iterations: 10, perIteration: 5, ceiling: 100 }),
];

describe('a search’s ceiling', () => {
  it('is never passed while each replay run and agent run costs at most its share, unpriced ones charged in full', () => {
    for (const budget of BUDGETS) {
      for (const unpricedEvery of [0, 3, 1]) {
        const search = searched(
          budget,
          (place) => {
            const perRun = aSearch({ set: SET, budget }).allotment.perRun;

            return unpricedEvery > 0 && place % unpricedEvery === 0
              ? null
              : perRun.amount;
          },
          (iteration) => {
            const agentRun = aSearch({ set: SET, budget }).allotment.agentRun;

            return iteration % 2 === 0
              ? ModelSpent.of([], 1)
              : ModelSpent.of([agentRun], 0);
          },
        );

        expect(search.isActive).toBe(false);
        expect(search.iterations.length).toBeGreaterThan(0);
        expect(search.heldOut.length).toBeGreaterThan(0);
        expect(search.spent.isWithin(budget.ceiling)).toBe(true);
      }
    }
  });

  it('is passed by at most what one agent run spent past its share, since it learns an agent run’s spend only after it ran', () => {
    for (const budget of BUDGETS) {
      const share = aSearch({ set: SET, budget }).allotment;
      const greedy = Spend.of(share.agentRun.amount * 3, 'USD');
      const search = searched(
        budget,
        () => share.perRun.amount,
        (iteration) =>
          ModelSpent.of(
            [iteration === budget.iterations ? greedy : share.agentRun],
            0,
          ),
      );

      const overshoot = Spend.of(greedy.amount - share.agentRun.amount, 'USD');

      expect(search.spent.isWithin(budget.ceiling.plus(overshoot))).toBe(true);
    }
  });
});
