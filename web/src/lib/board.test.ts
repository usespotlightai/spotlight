import { afterEach, describe, expect, it } from 'vitest';
import type { StationResponseDto } from '@/lib/api';
import {
  asBoardView,
  inView,
  rememberBoardView,
  rememberedBoardView,
} from '@/lib/board';

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

describe('the view a board is left on', () => {
  afterEach(() => localStorage.clear());

  it('opens on the active board until one is remembered', () => {
    expect(rememberedBoardView()).toBe('active');
  });

  it('remembers the last view looked at', () => {
    rememberBoardView('backlog');

    expect(rememberedBoardView()).toBe('backlog');
  });

  it('falls back to active when what was stored makes no sense', () => {
    localStorage.setItem('spotlight.board-view', 'nonsense');

    expect(rememberedBoardView()).toBe('active');
  });
});
