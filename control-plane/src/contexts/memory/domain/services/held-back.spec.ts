import {
  HeldBack,
  REJECTION_HOLDS_FOR_MS,
  type UpkeepHistory,
} from '@memory/domain/services/held-back';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const M1 = MemoryId.of('memory_1');

const history = (over: Partial<UpkeepHistory>): UpkeepHistory => ({
  memoryIds: [M1],
  finding: 'unused',
  state: 'pending',
  decidedAt: null,
  ...over,
});

describe('HeldBack', () => {
  it('holds every finding for a memory a waiting or approved change names', () => {
    for (const state of ['pending', 'approved'] as const) {
      const held = HeldBack.from(
        [history({ state, decidedAt: state === 'approved' ? NOW : null })],
        NOW,
      );

      expect(held.holds(M1, 'overlap')).toBe(true);
    }
  });

  it('holds only the same finding for a memory a person kept, for 90 days', () => {
    const kept = (daysAgo: number) =>
      HeldBack.from(
        [
          history({
            state: 'rejected',
            decidedAt: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000),
          }),
        ],
        NOW,
      );

    expect(kept(10).holds(M1, 'unused')).toBe(true);
    expect(kept(10).holds(M1, 'overlap')).toBe(false);
    expect(
      kept(REJECTION_HOLDS_FOR_MS / 86_400_000 + 1).holds(M1, 'unused'),
    ).toBe(false);
  });

  it('does not hold a memory whose change lapsed', () => {
    expect(
      HeldBack.from([history({ state: 'lapsed', decidedAt: NOW })], NOW).holds(
        M1,
        'unused',
      ),
    ).toBe(false);
  });

  it('holds what this sweep already takes', () => {
    expect(HeldBack.none().taking([M1]).isOpen(M1)).toBe(true);
  });
});
