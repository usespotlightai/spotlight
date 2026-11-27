import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { describe, expect, it } from 'vitest';

const refusalOf = (make: () => unknown): InvalidIdentifierError => {
  try {
    make();
  } catch (error) {
    if (error instanceof InvalidIdentifierError) {
      return error;
    }
  }

  throw new Error('expected an invalid identifier');
};

describe('InvalidIdentifierError', () => {
  it('advises how to write a name that is not lowercase words joined by dashes', () => {
    const refused = InvalidIdentifierError.notSlug(
      'runner pool key',
      'dev-host',
    );

    expect([refused.because, refused.message]).toEqual([
      'Use lowercase letters and digits, with single dashes between words, such as dev-host (at most 64 characters).',
      'Runner pool key is not valid. Use lowercase letters and digits, with single dashes between words, such as dev-host (at most 64 characters).',
    ]);
  });

  it('names another shape the name may take', () => {
    expect(
      InvalidIdentifierError.notSlug(
        'skill',
        'spotlight-handover',
        'a catalog skill id, such as catalog.research@1.0.0',
      ).because,
    ).toBe(
      'Use lowercase letters and digits, with single dashes between words, such as spotlight-handover (at most 64 characters), or a catalog skill id, such as catalog.research@1.0.0.',
    );
  });

  it('gives line and station keys the same advice', () => {
    expect([
      refusalOf(() => LineKey.of('Web App')).because,
      refusalOf(() => StationKey.of('Code Review')).because,
    ]).toEqual([
      'Use lowercase letters and digits, with single dashes between words, such as web-app (at most 64 characters).',
      'Use lowercase letters and digits, with single dashes between words, such as code-review (at most 64 characters).',
    ]);
  });
});
