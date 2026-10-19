import {
  DEFAULT_GUIDANCE,
  visibleGuidanceOf,
  visibleReasonsOf,
} from '@replays/application/rendering/visible-result';
import { reasonOf } from '@replays/domain/value-objects/entry-reason';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { describe, expect, it } from 'vitest';

const verdictOf = (value: number, guidance: string | null) =>
  JudgeVerdict.of({
    scale: 'number',
    value,
    claimResults: null,
    claims: [],
    passThreshold: 1,
    model: 'judge/model',
    referenced: false,
    reasons: [
      {
        text: 'It never drains the queue without dropping a job.',
        steps: [2],
        hunks: [],
        claim: null,
      },
    ],
    guidance,
  });

describe('visibleReasonsOf', () => {
  it('names a failed check or judgement by its code alone, once', () => {
    expect(
      visibleReasonsOf([
        reasonOf('check-failed', 'npm test -- --grep drain'),
        reasonOf('check-failed', 'api'),
        reasonOf('judge-failed', 'It drops a job when the queue restarts.'),
        reasonOf('judge-failed', 'It never drains the queue.'),
      ]),
    ).toEqual(['check-failed', 'judge-failed']);
    expect(
      visibleReasonsOf([reasonOf('judged', 'It drains the queue.')]),
    ).toEqual(['judged']);
  });

  it('keeps what went wrong around the work, which no verifier said', () => {
    expect(
      visibleReasonsOf([
        reasonOf('run-failed', 'the runner timed out'),
        reasonOf('check-skipped', 'no check asked'),
        reasonOf('unjudged', 'unavailable'),
      ]),
    ).toEqual([
      'run-failed: the runner timed out',
      'check-skipped: no check asked',
      'unjudged: unavailable',
    ]);
  });
});

describe('visibleGuidanceOf', () => {
  it('hands a failing verdict its guidance, never the judge’s reasons', () => {
    expect(visibleGuidanceOf(verdictOf(2, 'Finish taken jobs first.'))).toBe(
      'Finish taken jobs first.',
    );
  });

  it('falls back to a fixed sentence when a failing verdict has no line', () => {
    expect(visibleGuidanceOf(verdictOf(2, null))).toBe(DEFAULT_GUIDANCE);
  });

  it('has nothing to improve on a passing verdict, or without one', () => {
    expect(visibleGuidanceOf(verdictOf(5, 'Finish taken jobs first.'))).toBe(
      null,
    );
    expect(visibleGuidanceOf(null)).toBeNull();
  });
});
