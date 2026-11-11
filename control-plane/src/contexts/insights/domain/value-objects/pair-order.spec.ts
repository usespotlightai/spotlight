import { winnerOf } from '@insights/domain/value-objects/pair-order';
import { describe, expect, it } from 'vitest';

describe('winnerOf', () => {
  it('maps the label the judge preferred back to the run it showed there', () => {
    expect(winnerOf('run-first', 'A')).toBe('run');
    expect(winnerOf('run-first', 'B')).toBe('other');
    expect(winnerOf('other-first', 'A')).toBe('other');
    expect(winnerOf('other-first', 'B')).toBe('run');
    expect(winnerOf('other-first', 'tie')).toBe('tie');
  });
});
