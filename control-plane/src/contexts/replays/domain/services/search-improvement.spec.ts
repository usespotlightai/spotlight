import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  aBudget,
  aSearch,
  aSet,
  later,
  NOW,
  replayedAs,
  replayFor,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { improvedOnBestBefore } from '@replays/domain/services/search-improvement';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const SET = aSet(10);

const NONE = ModelSpent.of([], 0);

const proposedIn = (
  search: Search,
  number: number,
  name: string,
  ids: () => RunId,
): Search => {
  const run = RunId.of(`search_run_${number}`);

  return search
    .acceptProposal(run, {
      candidateId: CandidateId.of(`candidate_${name}`),
      name: CandidateName.searched(name),
      replayId: ReplayId.of(`replay_${name}`),
    })
    .recordRunEnd(run, { failed: false, started: true }, later(number), ids)
    .recordAgentSpend(run, NONE, later(number), ids);
};

const searchWith = (objective: SearchObjective = 'success'): Search => {
  const ids = searchRunIds();
  const seeded = aSearch({
    set: SET,
    objective,
    budget: aBudget({ iterations: 5 }),
  }).recordReplayStopReason(
    ReplayId.of('replay_seed'),
    'finished',
    { spent: Money.of(10, 'USD'), unpriced: 0 },
    NOW,
    ids,
    false,
  );
  const first = proposedIn(seeded, 1, 'firmer', ids).recordReplayStopReason(
    ReplayId.of('replay_firmer'),
    'finished',
    { spent: Money.of(1, 'USD'), unpriced: 0 },
    later(1),
    ids,
    true,
  );

  return proposedIn(first, 2, 'terse', ids);
};

const replayOf = (
  search: Search,
  id: string,
  candidate: string,
  succeeds: (original: string) => boolean,
  cost = 1,
) =>
  replayedAs(
    replayFor(
      SET,
      id,
      candidate,
      id === 'replay_seed' ? null : search.split.searchedRuns,
      id === 'replay_seed',
    ),
    (original) => (succeeds(original) ? 'completed' : 'failed'),
    cost,
  );

const TERSE = ReplayId.of('replay_terse');

describe('improvedOnBestBefore', () => {
  it('in a search for success, counts a candidate that clearly beats the best config before its iteration', () => {
    const search = searchWith();
    const replays = [
      replayOf(search, 'replay_seed', 'candidate_live', () => false),
      replayOf(search, 'replay_firmer', 'candidate_firmer', () => false),
      replayOf(search, 'replay_terse', 'candidate_terse', () => true),
    ];

    expect(improvedOnBestBefore(search, TERSE, replays, 0.05)).toBe(true);
  });

  it('does not count one that only matches the best before it, though it beats the seed', () => {
    const search = searchWith();
    const replays = [
      replayOf(search, 'replay_seed', 'candidate_live', () => false),
      replayOf(search, 'replay_firmer', 'candidate_firmer', () => true),
      replayOf(search, 'replay_terse', 'candidate_terse', () => true),
    ];

    expect(improvedOnBestBefore(search, TERSE, replays, 0.05)).toBe(false);
  });

  it('in a search for cost, counts one cheaper than the best before it at a success that is not worse', () => {
    const search = searchWith('cost');
    const replays = (terseCost: number, terseSucceeds: boolean) => [
      replayOf(search, 'replay_seed', 'candidate_live', () => true, 2),
      replayOf(search, 'replay_firmer', 'candidate_firmer', () => true, 2),
      replayOf(
        search,
        'replay_terse',
        'candidate_terse',
        () => terseSucceeds,
        terseCost,
      ),
    ];

    expect(improvedOnBestBefore(search, TERSE, replays(1, true), 0.05)).toBe(
      true,
    );
    expect(improvedOnBestBefore(search, TERSE, replays(2, true), 0.05)).toBe(
      false,
    );
    expect(improvedOnBestBefore(search, TERSE, replays(1, false), 0.05)).toBe(
      false,
    );
  });

  it('counts no improvement from a candidate whose replay did not finish, or that the search never proposed', () => {
    const search = searchWith();
    const seed = replayOf(search, 'replay_seed', 'candidate_live', () => false);

    expect(
      improvedOnBestBefore(
        search,
        TERSE,
        [seed, replayFor(SET, 'replay_terse', 'candidate_terse', null)],
        0.05,
      ),
    ).toBe(false);
    expect(
      improvedOnBestBefore(
        search,
        ReplayId.of('replay_stranger'),
        [seed],
        0.05,
      ),
    ).toBe(false);
  });
});
