import { InvalidRubricError } from '@insights/domain/exceptions/invalid-rubric.error';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { RUBRIC_VERSION } from '@insights/judging.fake-spec';
import { describe, expect, it } from 'vitest';

describe('Rubric', () => {
  it('holds the claims and the pass threshold its version names', () => {
    const rubric = Rubric.of({
      claims: ['It retries.'],
      passThreshold: 0.5,
      version: RUBRIC_VERSION,
    });

    expect(rubric.claims).toEqual(['It retries.']);
    expect(rubric.passThreshold).toBe(0.5);
    expect(rubric.version).toBe(RUBRIC_VERSION);
  });

  it('is named by a 64-character hash', () => {
    expect(() => Rubric.of({ claims: ['It retries.'], version: 'v1' })).toThrow(
      InvalidRubricError,
    );
  });

  it('is unreadable, rather than wrong, when it lists no claims', () => {
    expect(Rubric.readable({ claims: [], version: RUBRIC_VERSION })).toBeNull();
  });
});
