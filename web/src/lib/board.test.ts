import { describe, expect, it } from 'vitest';
import { asBoardView, inView } from '@/lib/board';

describe('board views', () => {
  it('keeps the backlog out of the active board', () => {
    expect([0, 1, 2].map((place) => inView('active', place))).toEqual([
      false,
      true,
      true,
    ]);
  });

  it('shows nothing but the backlog in the backlog view', () => {
    expect([0, 1, 2].map((place) => inView('backlog', place))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('falls back to the active board for an address that says nothing', () => {
    expect(asBoardView(null)).toBe('active');
    expect(asBoardView('nonsense')).toBe('active');
  });

  it('takes a view the address does name', () => {
    expect(asBoardView('backlog')).toBe('backlog');
  });
});
