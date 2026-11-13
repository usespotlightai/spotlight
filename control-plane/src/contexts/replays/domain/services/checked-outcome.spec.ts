import {
  aSet,
  replayedAs,
  replayFor,
  SEARCH_ID,
} from '@replays/domain/replays.fake-spec';
import { checkedOutcomeOf } from '@replays/domain/services/checked-outcome';
import { totalsOf } from '@replays/domain/services/replay-results';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const SET = aSet(3);
const [FIRST, SECOND, THIRD] = SET.runs as [RunId, RunId, RunId];

describe('checkedOutcomeOf', () => {
  it('joins the check’s own runs with the reused ones, counting only its own spend', () => {
    const searched = replayedAs(
      replayFor(
        SET,
        'replay_searched',
        'candidate_searched',
        [FIRST, SECOND],
        false,
        1,
        SEARCH_ID,
        'replay_seed',
      ),
      () => 'completed',
      2,
    );
    const own = replayedAs(
      replayFor(
        SET,
        'replay_own',
        'candidate_planned',
        [THIRD],
        false,
        1,
        null,
      ),
      () => 'failed',
      1,
    );
    const joined = checkedOutcomeOf(own.outcome(), [
      { outcome: searched.outcome(), runs: [FIRST] },
    ]);
    const totals = joined && totalsOf(joined);

    expect(joined?.id.value).toBe('replay_own');
    expect(joined?.originals.map((each) => each.value)).toEqual([
      THIRD.value,
      FIRST.value,
    ]);
    expect(totals?.entries).toBe(2);
    expect(totals?.succeeded).toBe(1);
    expect(totals?.spent.amount).toBe(own.outcome().spent.amount);
  });

  it('is finished on reused runs alone', () => {
    const searched = replayedAs(
      replayFor(
        SET,
        'replay_searched',
        'candidate_searched',
        SET.runs,
        false,
        1,
        SEARCH_ID,
        'replay_seed',
      ),
      () => 'completed',
    );

    expect(
      checkedOutcomeOf(null, [{ outcome: searched.outcome(), runs: SET.runs }])
        ?.current,
    ).toBe('finished');
  });
});
