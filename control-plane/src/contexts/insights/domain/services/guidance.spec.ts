import { guardedGuidanceOf } from '@insights/domain/services/guidance';
import { claimsCriteria } from '@insights/judging.fake-spec';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { MAX_GUIDANCE_LENGTH } from '@shared-kernel/domain/value-objects/judge-guidance';
import { describe, expect, it } from 'vitest';

const RETRIES = JudgeCriteria.of({
  claims: [
    'The upload must be retried with exponential backoff, never more than three times.',
  ],
});

describe('guardedGuidanceOf', () => {
  it('keeps one sentence about the task’s behaviour, trimmed', () => {
    expect(
      guardedGuidanceOf(
        '  Give up on an upload that keeps failing instead of looping.  ',
        RETRIES,
      ),
    ).toBe('Give up on an upload that keeps failing instead of looping.');
  });

  it('has nothing to say when the judge said nothing', () => {
    expect(guardedGuidanceOf(null, RETRIES)).toBeNull();
    expect(guardedGuidanceOf('   ', RETRIES)).toBeNull();
  });

  it('drops an guidance that shares five words in a row with a claim, whatever their case or punctuation', () => {
    expect(
      guardedGuidanceOf(
        'Make sure the UPLOAD must be, retried with backoff.',
        RETRIES,
      ),
    ).toBeNull();
    expect(
      guardedGuidanceOf('Stop after a few tries; the upload must be.', RETRIES),
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
      claims: ['It retries failed uploads.', 'Logs each retry.'],
    });

    expect(
      guardedGuidanceOf('Make sure it retries failed uploads, always.', short),
    ).toBeNull();
    expect(
      guardedGuidanceOf('Retry a failed upload before reporting it.', short),
    ).toBe('Retry a failed upload before reporting it.');
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
      guardedGuidanceOf('Retry. '.repeat(MAX_GUIDANCE_LENGTH), RETRIES),
    ).toBeNull();
    expect(
      guardedGuidanceOf('Retry the upload.\nThen give up.', RETRIES),
    ).toBeNull();
  });
});
