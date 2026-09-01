import { describe, expect, it } from 'vitest';
import type { StationResponseDto } from '@/lib/api';
import { asBoardView, inView } from '@/lib/board';

const kinds: StationResponseDto['kind'][] = ['backlog', 'work', 'completed'];

describe('board views', () => {
  it('keeps both ends of the line off the active board', () => {
    expect(kinds.map((kind) => inView('active', kind))).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('shows nothing but the backlog in the backlog view', () => {
    expect(kinds.map((kind) => inView('backlog', kind))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('shows nothing but what is finished in the completed view', () => {
    expect(kinds.map((kind) => inView('completed', kind))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('falls back to the active board for an address that says nothing', () => {
    expect(asBoardView(null)).toBe('active');
    expect(asBoardView('nonsense')).toBe('active');
  });

  it('takes a view the address does name', () => {
    expect(asBoardView('backlog')).toBe('backlog');
    expect(asBoardView('completed')).toBe('completed');
  });
});
