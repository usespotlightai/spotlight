import {
  bootstrapped,
  rateIntervalOf,
  seededRandom,
} from '@replays/domain/services/bootstrap';
import { describe, expect, it } from 'vitest';

describe('seededRandom', () => {
  it('draws the same numbers from the same seed, and others from another', () => {
    const one = seededRandom('replay_1');
    const again = seededRandom('replay_1');
    const other = seededRandom('replay_2');
    const drawn = Array.from({ length: 5 }, () => one());

    expect(Array.from({ length: 5 }, () => again())).toEqual(drawn);
    expect(Array.from({ length: 5 }, () => other())).not.toEqual(drawn);
    expect(drawn.every((each) => each >= 0 && each < 1)).toBe(true);
  });
});

describe('rateIntervalOf', () => {
  it('has no interval without a scored task', () => {
    expect(rateIntervalOf([], 'replay_1')).toBeNull();
  });

  it('is the mean of the tasks, the same each time it is read', () => {
    const tasks = [1, 0, 1, 1, 0, 1, 0, 1];
    const read = rateIntervalOf(tasks, 'replay_1');

    expect(read?.rate).toBe(5 / 8);
    expect(rateIntervalOf(tasks, 'replay_1')).toEqual(read);
  });

  it('collapses onto the rate when every task agrees', () => {
    expect(rateIntervalOf([1, 1, 1], 'replay_1')).toEqual({
      rate: 1,
      low: 1,
      high: 1,
    });
    expect(rateIntervalOf([0.5], 'replay_1')).toEqual({
      rate: 0.5,
      low: 0.5,
      high: 0.5,
    });
  });

  it('brackets the rate, and narrows as the tasks grow', () => {
    const few = rateIntervalOf([1, 0, 1, 0, 1, 0, 1, 0, 1, 0], 'set');
    const many = rateIntervalOf(
      Array.from({ length: 200 }, (_, at) => at % 2),
      'set',
    );

    if (!few || !many) {
      throw new Error('no interval');
    }

    expect(few.low).toBeLessThan(0.5);
    expect(few.high).toBeGreaterThan(0.5);
    expect(few.low).toBeGreaterThanOrEqual(0.1);
    expect(few.high).toBeLessThanOrEqual(0.9);
    expect(many.high - many.low).toBeLessThan(few.high - few.low);
    expect(many.low).toBeGreaterThan(0.38);
    expect(many.high).toBeLessThan(0.62);
  });
});

describe('bootstrapped', () => {
  it('reads the mean of paired differences with its interval', () => {
    const read = bootstrapped([0.5, 0.5, 0.5, 0.5], 'pair');

    expect(read).toEqual({ mean: 0.5, low: 0.5, high: 0.5 });
  });
});
