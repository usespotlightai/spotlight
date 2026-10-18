import { deltaOf, spendDeltaOf } from '@insights/domain/value-objects/delta.vo';
import { describe, expect, it } from 'vitest';

describe('deltaOf', () => {
  it('changes a count by a relative percent, good when it rose and up is better', () => {
    expect(deltaOf(12, 10, { better: 'up', unit: 'percent' })).toEqual({
      unit: 'percent',
      by: 0.2,
      fromZero: false,
      direction: 'up',
      tone: 'good',
    });
  });

  it('is bad when it rose and down is better', () => {
    expect(deltaOf(12, 10, { better: 'down', unit: 'percent' })?.tone).toBe(
      'bad',
    );
  });

  it('is good when it fell and down is better', () => {
    expect(deltaOf(5, 10, { better: 'down', unit: 'percent' })).toEqual({
      unit: 'percent',
      by: -0.5,
      fromZero: false,
      direction: 'down',
      tone: 'good',
    });
  });

  it('is flat whichever way it moved when neither way is better', () => {
    expect(deltaOf(5, 10, { better: 'neither', unit: 'percent' })?.tone).toBe(
      'flat',
    );
    expect(deltaOf(15, 10, { better: 'neither', unit: 'percent' })?.tone).toBe(
      'flat',
    );
  });

  it('rises from zero with no percent to give', () => {
    expect(deltaOf(3, 0, { better: 'up', unit: 'percent' })).toEqual({
      unit: 'percent',
      by: null,
      fromZero: true,
      direction: 'up',
      tone: 'good',
    });
  });

  it('is the same, and flat, when nothing moved', () => {
    expect(deltaOf(3, 3, { better: 'up', unit: 'percent' })).toEqual({
      unit: 'percent',
      by: 0,
      fromZero: false,
      direction: 'same',
      tone: 'flat',
    });
    expect(deltaOf(0, 0, { better: 'up', unit: 'percent' })?.direction).toBe(
      'same',
    );
  });

  it('changes a share by percentage points', () => {
    const change = deltaOf(0.55, 0.5, { better: 'up', unit: 'points' });

    expect(change?.unit).toBe('points');
    expect(change?.by).toBeCloseTo(0.05);
    expect(change?.direction).toBe('up');
    expect(change?.tone).toBe('good');
  });

  it('gives points from a share of zero, never from zero', () => {
    expect(deltaOf(0.2, 0, { better: 'down', unit: 'points' })).toEqual({
      unit: 'points',
      by: 0.2,
      fromZero: false,
      direction: 'up',
      tone: 'bad',
    });
  });

  it('counts a share that moved by less than a twentieth of a point as the same', () => {
    expect(
      deltaOf(0.5004, 0.5, { better: 'up', unit: 'points' })?.direction,
    ).toBe('same');
    expect(
      deltaOf(0.4994, 0.5, { better: 'up', unit: 'points' })?.direction,
    ).toBe('down');
  });

  it('has no change where either side is unknown', () => {
    expect(deltaOf(null, 3, { better: 'up', unit: 'percent' })).toBeNull();
    expect(deltaOf(3, null, { better: 'up', unit: 'points' })).toBeNull();
  });
});

describe('spendDeltaOf', () => {
  it('changes spend in one currency by a relative percent', () => {
    expect(
      spendDeltaOf(
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
      spendDeltaOf(
        { amount: 15, currency: 'USD' },
        { amount: 10, currency: 'EUR' },
        'neither',
      ),
    ).toBeNull();
    expect(
      spendDeltaOf(null, { amount: 10, currency: 'USD' }, 'neither'),
    ).toBeNull();
    expect(
      spendDeltaOf({ amount: 10, currency: 'USD' }, null, 'neither'),
    ).toBeNull();
  });
});
