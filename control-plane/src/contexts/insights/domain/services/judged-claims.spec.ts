import { judgedClaimsOf } from '@insights/domain/services/judged-claims';
import {
  judgeScore,
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
  rubricOf,
} from '@insights/judging.fake-spec';
import { describe, expect, it } from 'vitest';

describe('judgedClaimsOf', () => {
  it('names the claims the judge scored the run by, whatever the station says now', () => {
    const claims = judgedClaimsOf(
      judgeScore('run_1', [true, false], { passThreshold: 0.5 }),
      rubricOf(NEXT_RUBRIC_VERSION, ['Is the change small?']),
      rubricOf(RUBRIC_VERSION, ['It retries the upload.', 'It adds a test.']),
    );

    expect(claims).toEqual(['It retries the upload.', 'It adds a test.']);
  });

  it('names the station’s claims where the judge scored by them', () => {
    const claims = judgedClaimsOf(
      judgeScore('run_1', [true]),
      rubricOf(RUBRIC_VERSION, ['It retries the upload.']),
      null,
    );

    expect(claims).toEqual(['It retries the upload.']);
  });

  it('names no claims where the rubric the judge was given is not at hand', () => {
    expect(
      judgedClaimsOf(judgeScore('run_1', [true, false]), null, null),
    ).toEqual([null, null]);
  });

  it('has no claims without a judge to name them for', () => {
    expect(
      judgedClaimsOf(
        null,
        rubricOf(RUBRIC_VERSION, ['It retries the upload.']),
        null,
      ),
    ).toEqual([]);
  });
});
