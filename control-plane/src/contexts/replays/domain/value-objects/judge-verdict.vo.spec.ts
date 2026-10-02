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

  it('compares scores only on the same scale', () => {
    expect(verdict('number', 3).scoredAgainst(verdict('number', 5))).toBe(-2);
    expect(verdict('number', 3).scoredAgainst(verdict('yes-no', 1))).toBeNull();
  });

  it('holds only a score on its scale', () => {
    expect(() => verdict('number', 6)).toThrow(InvalidReplayError);
    expect(() => verdict('yes-no', 2)).toThrow(InvalidReplayError);
    expect(() => verdict('stars', 1)).toThrow(InvalidReplayError);
  });
});
