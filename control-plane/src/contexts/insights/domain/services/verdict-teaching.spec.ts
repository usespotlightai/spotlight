import { verdictTeachingOf } from '@insights/domain/services/verdict-teaching';
import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
} from '@insights/judging.fake-spec';
import { scoreFactOf } from '@insights/runs.fake-spec';
import { describe, expect, it } from 'vitest';

describe('verdictTeachingOf', () => {
  it('teaches the judge only through a run its current claims judged', () => {
    const scored = [scoreFactOf(judgeScore('run_1', [true]))];

    expect(verdictTeachingOf(scored, RUBRIC_VERSION)).toBe('judge');
    expect(verdictTeachingOf([], RUBRIC_VERSION)).toBe('unjudged-run');
    expect(verdictTeachingOf(scored, NEXT_RUBRIC_VERSION)).toBe('unjudged-run');
    expect(verdictTeachingOf(scored, null)).toBe('no-judge');
  });
});
