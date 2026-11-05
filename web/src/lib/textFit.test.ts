import { describe, expect, it } from 'vitest';
import { fitToWidth } from '@/lib/textFit';

const width = (text: string) => text.length * 6;

describe('fitToWidth', () => {
  it('keeps text that fits', () => {
    expect(fitToWidth('abcdef', width, 36)).toBe('abcdef');
  });

  it('cuts text that is too wide and adds an ellipsis within the limit', () => {
    const result = fitToWidth('abcdefghij', width, 36);

    expect(result).toBe('abcde…');
    expect(width(result)).toBeLessThanOrEqual(36);
  });

  it('returns only the ellipsis when nothing fits', () => {
    expect(fitToWidth('abcdefghij', width, 3)).toBe('…');
  });
});
