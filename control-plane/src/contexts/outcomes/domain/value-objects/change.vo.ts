import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

export const CHANGE_UNITS = ['percent', 'points'] as const;

export type ChangeUnit = (typeof CHANGE_UNITS)[number];

export const CHANGE_DIRECTIONS = ['up', 'down', 'same'] as const;

type ChangeDirection = (typeof CHANGE_DIRECTIONS)[number];

export const CHANGE_TONES = ['good', 'bad', 'flat'] as const;

type ChangeTone = (typeof CHANGE_TONES)[number];

export type Better = 'up' | 'down' | 'neither';

export interface Change {
  readonly unit: ChangeUnit;
  readonly by: number | null;
  readonly fromZero: boolean;
  readonly direction: ChangeDirection;
  readonly tone: ChangeTone;
}

interface Measured {
  readonly better: Better;
  readonly unit: ChangeUnit;
}

const SAME_POINTS = 0.0005;

const toneOf = (direction: ChangeDirection, better: Better): ChangeTone =>
  direction === 'same' || better === 'neither'
    ? 'flat'
    : direction === better
      ? 'good'
      : 'bad';

const byOf = (now: number, before: number, unit: ChangeUnit): number | null =>
  unit === 'points'
    ? now - before
    : before === 0
      ? null
      : (now - before) / before;

const directionOf = (
  now: number,
  before: number,
  unit: ChangeUnit,
): ChangeDirection => {
  const moved =
    unit === 'points' ? Math.abs(now - before) >= SAME_POINTS : now !== before;

  return !moved ? 'same' : now > before ? 'up' : 'down';
};

export const changeOf = (
  now: number | null,
  before: number | null,
  { better, unit }: Measured,
): Change | null => {
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

export const spendChangeOf = (
  now: Spend | null,
  before: Spend | null,
  better: Better,
): Change | null =>
  now && before && now.currency === before.currency
    ? changeOf(now.amount, before.amount, { better, unit: 'percent' })
    : null;
