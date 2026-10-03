import {
  type ComposedOriginal,
  compositionOf,
  type OriginalOutcome,
} from '@replays/domain/services/composition';
import { describe, expect, it } from 'vitest';

const original = (
  outcome: OriginalOutcome,
  endedAt: string | null = null,
  origin: string | null = 'person',
): ComposedOriginal => ({
  outcome,
  origin,
  endedAt: endedAt ? new Date(endedAt) : null,
});

const many = (outcome: OriginalOutcome, count: number): ComposedOriginal[] =>
  Array.from({ length: count }, () => original(outcome));

describe('compositionOf', () => {
  it('counts every outcome, in one order, even those no original had', () => {
    expect(
      compositionOf([
        original('accepted'),
        original('failed'),
        original('failed'),
      ]).outcomes,
    ).toEqual([
      { outcome: 'accepted', count: 1 },
      { outcome: 'sent-back', count: 0 },
      { outcome: 'asked', count: 0 },
      { outcome: 'failed', count: 2 },
      { outcome: 'other', count: 0 },
    ]);
  });

  it('counts where the tasks came from, the most common first, an unknown origin as unknown', () => {
    expect(
      compositionOf([
        original('accepted', null, 'slack'),
        original('accepted', null, 'person'),
        original('failed', null, 'slack'),
        original('failed', null, null),
      ]).origins,
    ).toEqual([
      { origin: 'slack', count: 2 },
      { origin: 'person', count: 1 },
      { origin: 'unknown', count: 1 },
    ]);
  });

  it('dates the oldest, median and newest original, leaving out those with no end', () => {
    const composed = compositionOf([
      original('accepted', '2026-09-03T00:00:00.000Z'),
      original('accepted', '2026-09-01T00:00:00.000Z'),
      original('accepted', null),
      original('accepted', '2026-09-02T00:00:00.000Z'),
    ]);

    expect(composed.oldest?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(composed.median?.toISOString()).toBe('2026-09-02T00:00:00.000Z');
    expect(composed.newest?.toISOString()).toBe('2026-09-03T00:00:00.000Z');
  });

  it('takes the median of an even count halfway between the two middle ones', () => {
    expect(
      compositionOf([
        original('accepted', '2026-09-01T00:00:00.000Z'),
        original('accepted', '2026-09-03T00:00:00.000Z'),
      ]).median?.toISOString(),
    ).toBe('2026-09-02T00:00:00.000Z');
  });

  it('has no dates when no original ended', () => {
    const composed = compositionOf([]);

    expect(composed.entries).toBe(0);
    expect(composed.oldest).toBeNull();
    expect(composed.median).toBeNull();
    expect(composed.newest).toBeNull();
    expect(composed.balanceWarning).toBeNull();
  });

  it('warns when one outcome is more than two thirds of a set of at least 6', () => {
    expect(
      compositionOf([...many('failed', 5), original('accepted')])
        .balanceWarning,
    ).toEqual({ dominant: 'failed', count: 5, entries: 6 });
  });

  it('does not warn at exactly two thirds', () => {
    expect(
      compositionOf([...many('failed', 4), ...many('accepted', 2)])
        .balanceWarning,
    ).toBeNull();
  });

  it('does not warn when what crowds the set is runs that turned out some other way', () => {
    expect(
      compositionOf([...many('other', 5), original('accepted')]).balanceWarning,
    ).toBeNull();
  });

  it('does not warn about a set of fewer than 6, however one-sided', () => {
    expect(compositionOf(many('failed', 5)).balanceWarning).toBeNull();
  });
});
