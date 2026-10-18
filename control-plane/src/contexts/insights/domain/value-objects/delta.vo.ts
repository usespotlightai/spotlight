import type { Money } from '@insights/domain/value-objects/run-usage.vo';

export const DELTA_UNITS = ['percent', 'points'] as const;

export type DeltaUnit = (typeof DELTA_UNITS)[number];

export const DELTA_DIRECTIONS = ['up', 'down', 'same'] as const;

type DeltaDirection = (typeof DELTA_DIRECTIONS)[number];

export const DELTA_TONES = ['good', 'bad', 'flat'] as const;

type DeltaTone = (typeof DELTA_TONES)[number];

export type Better = 'up' | 'down' | 'neither';

export interface Delta {
  readonly unit: DeltaUnit;
  readonly by: number | null;
  readonly fromZero: boolean;
  readonly direction: DeltaDirection;
  readonly tone: DeltaTone;
}

interface Measured {
  readonly better: Better;
  readonly unit: DeltaUnit;
}

const SAME_POINTS = 0.0005;

const toneOf = (direction: DeltaDirection, better: Better): DeltaTone =>
  direction === 'same' || better === 'neither'
    ? 'flat'
    : direction === better
      ? 'good'
      : 'bad';

const byOf = (now: number, before: number, unit: DeltaUnit): number | null =>
  unit === 'points'
    ? now - before
    : before === 0
      ? null
      : (now - before) / before;

const directionOf = (
  now: number,
  before: number,
  unit: DeltaUnit,
): DeltaDirection => {
  const moved =
    unit === 'points' ? Math.abs(now - before) >= SAME_POINTS : now !== before;

  return !moved ? 'same' : now > before ? 'up' : 'down';
};

export const deltaOf = (
  now: number | null,
  before: number | null,
  { better, unit }: Measured,
): Delta | null => {
  if (now === null || before === null) {
    return null;
  }

  const direction = directionOf(now, before, unit);

  if (direction === 'same') {
    return { unit, by: 0, fromZero: false, direction, tone: 'flat' };
  }

  const by = byOf(now, before, unit);

  return {
    unit,
    by,
    fromZero: by === null,
    direction,
    tone: toneOf(direction, better),
  };
};

export const spendDeltaOf = (
  now: Money | null,
  before: Money | null,
  better: Better,
): Delta | null =>
  now && before && now.currency === before.currency
    ? deltaOf(now.amount, before.amount, { better, unit: 'percent' })
    : null;
