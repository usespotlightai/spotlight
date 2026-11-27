import { claimFlipsOf } from '@replays/domain/services/claim-flips';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { describe, expect, it } from 'vitest';

const CLAIMS = ['It finds real faults.', 'It says where each one is.'];

const verdictOf = (claimResults: readonly boolean[], claims = CLAIMS) =>
  JudgeVerdict.of({
    claimResults,
    claims,
    passThreshold: 1,
    model: 'judge/model',
    referenced: false,
    reasons: [],
    guidance: null,
  });

const twice = (first: JudgeVerdict | null, second: JudgeVerdict | null) => ({
  judging: { verdict: first },
  secondJudging: second ? { verdict: second } : null,
});

describe('claimFlipsOf', () => {
  it('counts the runs in which each claim came out differently the second time, most first', () => {
    expect(
      claimFlipsOf([
        twice(verdictOf([true, true]), verdictOf([true, false])),
        twice(verdictOf([true, true]), verdictOf([false, false])),
        twice(verdictOf([false, true]), verdictOf([true, false])),
        twice(verdictOf([true, true]), verdictOf([true, true])),
      ]),
    ).toEqual([
      { claim: 'It says where each one is.', flipped: 3 },
      { claim: 'It finds real faults.', flipped: 2 },
    ]);
  });

  it('skips runs judged once, and runs judged twice against other claims', () => {
    expect(
      claimFlipsOf([
        twice(verdictOf([true, true]), null),
        twice(null, verdictOf([true, true])),
        twice(
          verdictOf([true, true]),
          verdictOf([false, false], ['Other claim.', 'Another claim.']),
        ),
      ]),
    ).toEqual([]);
  });
});
