import { WrittenText } from '@work/domain/value-objects/written-text';
import { describe, expect, it } from 'vitest';

class Refused extends Error {}

describe('WrittenText', () => {
  it('keeps prose exactly as written, judging only what it says', () => {
    expect(WrittenText.prose('  Review it.\n', 10, Refused)).toBe(
      '  Review it.\n',
    );
    expect(() => WrittenText.prose(' \n\n', 10, Refused)).toThrow(
      'must not be empty',
    );
    expect(() => WrittenText.prose('Review it all.', 10, Refused)).toThrow(
      'must be at most 10 characters',
    );
  });

  it('keeps one line exactly as written, trailing newline included', () => {
    expect(WrittenText.oneLine('npm test\n', 10, Refused)).toBe('npm test\n');
    expect(() => WrittenText.oneLine('npm ci\nnpm test', 20, Refused)).toThrow(
      Refused,
    );
    expect(() => WrittenText.oneLine('  ', 20, Refused)).toThrow(
      'is one line of at most 20 characters',
    );
  });
});
