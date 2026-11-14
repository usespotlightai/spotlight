import { excerptOf } from '@work/application/rendering/excerpt';
import { describe, expect, it } from 'vitest';

describe('excerptOf', () => {
  it('keeps a short text as it is, without the blank space around it', () => {
    expect(excerptOf('  Too many connections.\n', 600)).toBe(
      'Too many connections.',
    );
  });

  it('cuts a long text and marks the cut', () => {
    expect(excerptOf('abcdef', 3)).toBe('abc…');
  });

  it.each([null, '', ' \n '])('gives nothing for %j', (text) => {
    expect(excerptOf(text, 600)).toBeNull();
  });

  it('never cuts a character in two', () => {
    expect(excerptOf('ab😀c', 3)).toBe('ab😀…');
  });
});
