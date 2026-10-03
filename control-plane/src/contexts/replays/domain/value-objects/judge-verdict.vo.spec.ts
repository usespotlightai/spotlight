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
    marks: null,
    claims: [],
    passShare: 1,
    model: 'judge/model',
    referenced: false,
    reasons: [],
  });

describe('JudgeVerdict', () => {
  it('passes a yes, and a number score from the passing score up', () => {
    expect(verdict('yes-no', 1).passes).toBe(true);
    expect(verdict('yes-no', 0).passes).toBe(false);
    expect(verdict('number', PASSING_SCORE).passes).toBe(true);
    expect(verdict('number', PASSING_SCORE - 1).passes).toBe(false);
  });

  it('holds only a score on its scale', () => {
    expect(() => verdict('number', 6)).toThrow(InvalidReplayError);
    expect(() => verdict('yes-no', 2)).toThrow(InvalidReplayError);
    expect(() => verdict('stars', 1)).toThrow(InvalidReplayError);
  });

  it('passes claims by the share met, against the share the judge asks', () => {
    const claims = (marks: boolean[], passShare: number) =>
      JudgeVerdict.of({
        scale: 'claims',
        value: marks.filter(Boolean).length / marks.length,
        marks,
        claims: marks.map((_, at) => `Claim ${at}.`),
        passShare,
        model: 'judge/model',
        referenced: false,
        reasons: [{ text: 'It retries.', steps: [], hunks: [], claim: 0 }],
      });

    expect(claims([true, true, false], 2 / 3).passes).toBe(true);
    expect(claims([true, false, false], 2 / 3).passes).toBe(false);
    expect(claims([true, true], 1).passes).toBe(true);
    expect(claims([true, false], 1).passes).toBe(false);
    expect(claims([true], 1).reasons[0]?.claim).toBe(0);
    expect(claims([true, false], 1).claims).toEqual(['Claim 0.', 'Claim 1.']);
  });

  it('holds marks only on claims, and a score that is the share they give', () => {
    const base = {
      model: 'judge/model',
      referenced: false,
      reasons: [],
      passShare: 1,
      claims: ['One.', 'Two.'],
    };

    expect(() =>
      JudgeVerdict.of({
        ...base,
        scale: 'claims',
        value: 1,
        marks: [true, false],
      }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      JudgeVerdict.of({ ...base, scale: 'claims', value: 1, marks: null }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      JudgeVerdict.of({ ...base, scale: 'claims', value: 1, marks: [true] }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      JudgeVerdict.of({
        ...base,
        scale: 'yes-no',
        value: 1,
        marks: null,
      }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      JudgeVerdict.of({
        ...base,
        scale: 'claims',
        value: 1,
        marks: [true, true],
        passShare: 2,
      }),
    ).toThrow(InvalidReplayError);
  });
});
