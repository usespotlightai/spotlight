import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import {
  JudgeVerdict,
  PASSING_SCORE,
} from '@replays/domain/value-objects/judge-verdict.vo';
import { describe, expect, it } from 'vitest';

const verdict = (scale: string, value: number) =>
  JudgeVerdict.of({
    scale,
    value,
    claimResults: null,
    claims: [],
    passThreshold: 1,
    model: 'judge/model',
    referenced: false,
    reasons: [],
    guidance: null,
  });

describe('JudgeVerdict', () => {
  it('passes a yes, and a number score from the passing score up', () => {
    expect(verdict('yes-no', 1).passes).toBe(true);
    expect(verdict('yes-no', 0).passes).toBe(false);
    expect(verdict('number', PASSING_SCORE).passes).toBe(true);
    expect(verdict('number', PASSING_SCORE - 1).passes).toBe(false);
  });

  it('keeps what to improve only on a verdict that fails', () => {
    const guidanceFor = (value: number) =>
      JudgeVerdict.of({
        scale: 'yes-no',
        value,
        claimResults: null,
        claims: [],
        passThreshold: 1,
        model: 'judge/model',
        referenced: false,
        reasons: [],
        guidance: 'Finish taken jobs first.',
      }).guidance;

    expect(guidanceFor(0)).toBe('Finish taken jobs first.');
    expect(guidanceFor(1)).toBeNull();
    expect(verdict('yes-no', 0).guidance).toBeNull();
  });

  it('takes only a score on its scale', () => {
    expect(() => verdict('number', 6)).toThrow(InvalidReplayError);
    expect(() => verdict('yes-no', 2)).toThrow(InvalidReplayError);
    expect(() => verdict('stars', 1)).toThrow(InvalidReplayError);
  });

  it('passes claims by the share met, against the share the judge requires', () => {
    const claims = (claimResults: boolean[], passThreshold: number) =>
      JudgeVerdict.of({
        scale: 'claims',
        value: claimResults.filter(Boolean).length / claimResults.length,
        claimResults,
        claims: claimResults.map((_, at) => `Claim ${at}.`),
        passThreshold,
        model: 'judge/model',
        referenced: false,
        reasons: [{ text: 'It retries.', steps: [], hunks: [], claim: 0 }],
        guidance: null,
      });

    expect(claims([true, true, false], 2 / 3).passes).toBe(true);
    expect(claims([true, false, false], 2 / 3).passes).toBe(false);
    expect(claims([true, true], 1).passes).toBe(true);
    expect(claims([true, false], 1).passes).toBe(false);
    expect(claims([true], 1).reasons[0]?.claim).toBe(0);
    expect(claims([true, false], 1).claims).toEqual(['Claim 0.', 'Claim 1.']);
  });

  it('has claim results only on claims, and a score that is the rate they meet', () => {
    const base = {
      model: 'judge/model',
      referenced: false,
      reasons: [],
      passThreshold: 1,
      claims: ['One.', 'Two.'],
      guidance: null,
    };

    expect(() =>
      JudgeVerdict.of({
        ...base,
        scale: 'claims',
        value: 1,
        claimResults: [true, false],
      }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      JudgeVerdict.of({
        ...base,
        scale: 'claims',
        value: 1,
        claimResults: null,
      }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      JudgeVerdict.of({
        ...base,
        scale: 'claims',
        value: 1,
        claimResults: [true],
      }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      JudgeVerdict.of({
        ...base,
        scale: 'yes-no',
        value: 1,
        claimResults: null,
      }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      JudgeVerdict.of({
        ...base,
        scale: 'claims',
        value: 1,
        claimResults: [true, true],
        passThreshold: 2,
      }),
    ).toThrow(InvalidReplayError);
  });
});
