import { WrittenText } from '@work/domain/value-objects/written-text';
import { describe, expect, it } from 'vitest';

class Invalid extends Error {}

describe('WrittenText', () => {
  it('keeps the text exactly as written, judging only what it says', () => {
    expect(WrittenText.of('  Review it.\n', 10, Invalid)).toBe(
      '  Review it.\n',
    );
    expect(() => WrittenText.of(' \n\n', 10, Invalid)).toThrow(
      'must not be empty',
    );
    expect(() => WrittenText.of('Review it all.', 10, Invalid)).toThrow(
      'must be at most 10 characters',
    );
  });

  it('keeps a script of many lines', () => {
    expect(WrittenText.of('set -e\nnpm ci\nnpm test\n', 30, Invalid)).toBe(
      'set -e\nnpm ci\nnpm test\n',
    );
  });
});
