import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { describe, expect, it } from 'vitest';

const verdict = (
  claimResults: boolean[],
  passThreshold = 1,
  guidance: string | null = null,
) =>
  JudgeVerdict.of({
    claimResults,
    claims: claimResults.map((_, at) => `Claim ${at}.`),
    passThreshold,
    model: 'judge/model',
    referenced: false,
    reasons: [{ text: 'It retries.', steps: [], hunks: [], claim: 0 }],
    guidance,
  });

describe('JudgeVerdict', () => {
  it('passes claims by the share met, against the share the judge requires', () => {
    expect(verdict([true, true, false], 2 / 3).passes).toBe(true);
    expect(verdict([true, false, false], 2 / 3).passes).toBe(false);
    expect(verdict([true, true]).passes).toBe(true);
    expect(verdict([true, false]).passes).toBe(false);
    expect(verdict([true]).reasons[0]?.claim).toBe(0);
    expect(verdict([true, false]).claims).toEqual(['Claim 0.', 'Claim 1.']);
  });

  it('scores the share of claims met', () => {
    expect(verdict([true, false, true, true]).value).toBe(0.75);
  });

  it('keeps what to improve only on a verdict that fails', () => {
    expect(verdict([false], 1, 'Finish taken jobs first.').guidance).toBe(
      'Finish taken jobs first.',
    );
    expect(verdict([true], 1, 'Finish taken jobs first.').guidance).toBeNull();
    expect(verdict([false]).guidance).toBeNull();
  });

  it('marks every claim it names, and takes a pass threshold from 0 to 1', () => {
    const base = {
      model: 'judge/model',
      referenced: false,
      reasons: [],
      passThreshold: 1,
      claims: ['One.', 'Two.'],
      guidance: null,
    };

    expect(() => JudgeVerdict.of({ ...base, claimResults: [true] })).toThrow(
      InvalidReplayError,
    );
    expect(() =>
      JudgeVerdict.of({ ...base, claims: [], claimResults: [] }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      JudgeVerdict.of({
        ...base,
        claimResults: [true, true],
        passThreshold: 2,
      }),
    ).toThrow(InvalidReplayError);
  });
});
