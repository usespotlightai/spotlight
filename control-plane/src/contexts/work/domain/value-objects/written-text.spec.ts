import { WrittenText } from '@work/domain/value-objects/written-text';
import { describe, expect, it } from 'vitest';

class Invalid extends Error {}

describe('WrittenText', () => {
  it('keeps prose exactly as written, judging only what it says', () => {
    expect(WrittenText.prose('  Review it.\n', 10, Invalid)).toBe(
      '  Review it.\n',
    );
    expect(() => WrittenText.prose(' \n\n', 10, Invalid)).toThrow(
      'must not be empty',
    );
    expect(() => WrittenText.prose('Review it all.', 10, Invalid)).toThrow(
      'must be at most 10 characters',
    );
  });

  it('keeps one line exactly as written, trailing newline included', () => {
    expect(WrittenText.oneLine('npm test\n', 10, Invalid)).toBe('npm test\n');
    expect(() => WrittenText.oneLine('npm ci\nnpm test', 20, Invalid)).toThrow(
      Invalid,
    );
    expect(() => WrittenText.oneLine('  ', 20, Invalid)).toThrow(
      'is one line of at most 20 characters',
    );
  });
});
