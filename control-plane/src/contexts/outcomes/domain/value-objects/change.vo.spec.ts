import {
  changeOf,
  spendChangeOf,
} from '@outcomes/domain/value-objects/change.vo';
import { describe, expect, it } from 'vitest';

describe('changeOf', () => {
  it('changes a count by a relative percent, good when it rose and up is better', () => {
    expect(changeOf(12, 10, { better: 'up', unit: 'percent' })).toEqual({
      unit: 'percent',
      by: 0.2,
      fromZero: false,
      direction: 'up',
      tone: 'good',
    });
  });

  it('is bad when it rose and down is better', () => {
    expect(changeOf(12, 10, { better: 'down', unit: 'percent' })?.tone).toBe(
      'bad',
    );
  });

  it('is good when it fell and down is better', () => {
    expect(changeOf(5, 10, { better: 'down', unit: 'percent' })).toEqual({
      unit: 'percent',
      by: -0.5,
      fromZero: false,
      direction: 'down',
      tone: 'good',
    });
  });

  it('is flat whichever way it moved when neither way is better', () => {
    expect(changeOf(5, 10, { better: 'neither', unit: 'percent' })?.tone).toBe(
      'flat',
    );
    expect(changeOf(15, 10, { better: 'neither', unit: 'percent' })?.tone).toBe(
      'flat',
    );
  });

  it('rises from zero with no percent to give', () => {
    expect(changeOf(3, 0, { better: 'up', unit: 'percent' })).toEqual({
      unit: 'percent',
      by: null,
      fromZero: true,
      direction: 'up',
      tone: 'good',
    });
  });

  it('is the same, and flat, when nothing moved', () => {
    expect(changeOf(3, 3, { better: 'up', unit: 'percent' })).toEqual({
      unit: 'percent',
      by: 0,
      fromZero: false,
      direction: 'same',
      tone: 'flat',
    });
    expect(changeOf(0, 0, { better: 'up', unit: 'percent' })?.direction).toBe(
      'same',
    );
  });

  it('changes a share by percentage points', () => {
    const change = changeOf(0.55, 0.5, { better: 'up', unit: 'points' });

    expect(change?.unit).toBe('points');
    expect(change?.by).toBeCloseTo(0.05);
    expect(change?.direction).toBe('up');
    expect(change?.tone).toBe('good');
  });

  it('gives points from a share of zero, never from zero', () => {
    expect(changeOf(0.2, 0, { better: 'down', unit: 'points' })).toEqual({
      unit: 'points',
      by: 0.2,
      fromZero: false,
      direction: 'up',
      tone: 'bad',
    });
  });

  it('counts a share that moved by less than a twentieth of a point as the same', () => {
    expect(
      changeOf(0.5004, 0.5, { better: 'up', unit: 'points' })?.direction,
    ).toBe('same');
    expect(
      changeOf(0.4994, 0.5, { better: 'up', unit: 'points' })?.direction,
    ).toBe('down');
  });

  it('has no change where either side is unknown', () => {
    expect(changeOf(null, 3, { better: 'up', unit: 'percent' })).toBeNull();
    expect(changeOf(3, null, { better: 'up', unit: 'points' })).toBeNull();
  });
});

describe('spendChangeOf', () => {
  it('changes spend in one currency by a relative percent', () => {
    expect(
      spendChangeOf(
        { amount: 15, currency: 'USD' },
        { amount: 10, currency: 'USD' },
        'down',
      ),
    ).toEqual({
      unit: 'percent',
      by: 0.5,
      fromZero: false,
      direction: 'up',
      tone: 'bad',
    });
  });

  it('has no change across currencies or where either side has no spend', () => {
    expect(
      spendChangeOf(
        { amount: 15, currency: 'USD' },
        { amount: 10, currency: 'EUR' },
        'neither',
      ),
    ).toBeNull();
    expect(
      spendChangeOf(null, { amount: 10, currency: 'USD' }, 'neither'),
    ).toBeNull();
    expect(
      spendChangeOf({ amount: 10, currency: 'USD' }, null, 'neither'),
    ).toBeNull();
  });
});
