import { InvalidReplayedPeriodError } from '@replays/domain/exceptions/invalid-replayed-period.error';
import { ReplayedPeriod } from '@replays/domain/value-objects/replayed-period.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T15:30:00.000Z');

describe('ReplayedPeriod', () => {
  it.each([
    ['7d', '2026-09-25T00:00:00.000Z'],
    ['30d', '2026-09-02T00:00:00.000Z'],
    ['90d', '2026-07-04T00:00:00.000Z'],
  ])(
    'looks back over the same UTC days as the insights %s period',
    (name, from) => {
      const period = ReplayedPeriod.of(name, NOW);

      expect(period.from).toEqual(new Date(from));
      expect(period.to).toEqual(new Date('2026-10-02T00:00:00.000Z'));
    },
  );

  it('looks back whole UTC days, today included', () => {
    const period = ReplayedPeriod.of('7d', NOW);

    expect(period.from).toEqual(new Date('2026-09-25T00:00:00.000Z'));
    expect(period.to).toEqual(new Date('2026-10-02T00:00:00.000Z'));
  });

  it('includes its start but not its end', () => {
    const period = ReplayedPeriod.of('30d', NOW);

    expect(period.includes(period.from)).toBe(true);
    expect(period.includes(new Date(period.from.getTime() - 1))).toBe(false);
    expect(period.includes(period.to)).toBe(false);
  });

  it('is only ever 7, 30 or 90 days, without repeating what was requested', () => {
    expect(() => ReplayedPeriod.of('14d', NOW)).toThrow(
      InvalidReplayedPeriodError,
    );
    expect(() => ReplayedPeriod.of('', NOW)).toThrow(
      InvalidReplayedPeriodError,
    );
    expect(() => ReplayedPeriod.of('<b>14d</b>', NOW)).toThrow(
      /^Period must be 7d, 30d or 90d\.$/,
    );
  });
});
