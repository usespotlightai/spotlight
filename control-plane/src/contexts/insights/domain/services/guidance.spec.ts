import { claimsCriteria } from '@insights/domain/judging.fake-spec';
import { guardedGuidanceOf } from '@insights/domain/services/guidance';
import { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import { MAX_GUIDANCE_LENGTH } from '@shared-kernel/domain/value-objects/judge-guidance';
import { describe, expect, it } from 'vitest';

const RUBRIC = JudgeCriteria.of({
  rubric:
    'scores: yes-no\nThe upload must be retried with exponential backoff, never more than three times.',
});

describe('guardedGuidanceOf', () => {
  it('keeps one sentence about the task’s behaviour, trimmed', () => {
    expect(
      guardedGuidanceOf(
        '  Give up on an upload that keeps failing instead of looping.  ',
        RUBRIC,
      ),
    ).toBe('Give up on an upload that keeps failing instead of looping.');
  });

  it('has nothing to say when the judge said nothing', () => {
    expect(guardedGuidanceOf(null, RUBRIC)).toBeNull();
    expect(guardedGuidanceOf('   ', RUBRIC)).toBeNull();
  });

  it('drops an guidance that shares five words in a row with the rubric, whatever their case or punctuation', () => {
    expect(
      guardedGuidanceOf(
        'Make sure the UPLOAD must be, retried with backoff.',
        RUBRIC,
      ),
    ).toBeNull();
    expect(
      guardedGuidanceOf('Stop after a few tries; the upload must be.', RUBRIC),
    ).toBe('Stop after a few tries; the upload must be.');
  });

  it('drops an guidance that shares five words in a row with any claim', () => {
    expect(
      guardedGuidanceOf(
        'Write it so it adds a test for the retry path.',
        claimsCriteria(),
      ),
    ).toBeNull();
  });

  it('drops an guidance that contains the whole of a short claim', () => {
    const short = JudgeCriteria.of({
      rubric: null,
      claims: ['It retries failed uploads.', 'Logs each retry.'],
    });

    expect(
      guardedGuidanceOf('Make sure it retries failed uploads, always.', short),
    ).toBeNull();
    expect(
      guardedGuidanceOf('Retry a failed upload before reporting it.', short),
    ).toBe('Retry a failed upload before reporting it.');
  });

  it('drops an guidance that quotes one short item of a rubric list', () => {
    const listed = JudgeCriteria.of({
      rubric:
        'scores: 1-5\n- Keeps the job order\n- Never drops a job\n- Logs restarts',
    });

    expect(
      guardedGuidanceOf(
        'It should never drop a job; it never drops a job now.',
        listed,
      ),
    ).toBeNull();
    expect(
      guardedGuidanceOf('Take the jobs in the order they arrived.', listed),
    ).toBe('Take the jobs in the order they arrived.');
  });

  it('drops an guidance that names a claim by its number', () => {
    for (const said of [
      'Claim 2 is not met yet.',
      'Work on claims #1 and 3.',
      'See item 0.',
      'Address #2.',
      'The second claim still fails.',
    ]) {
      expect(guardedGuidanceOf(said, claimsCriteria())).toBeNull();
    }
  });

  it('drops an guidance over the length limit, or one that spans several lines', () => {
    expect(
      guardedGuidanceOf('Retry. '.repeat(MAX_GUIDANCE_LENGTH), RUBRIC),
    ).toBeNull();
    expect(
      guardedGuidanceOf('Retry the upload.\nThen give up.', RUBRIC),
    ).toBeNull();
  });
});
