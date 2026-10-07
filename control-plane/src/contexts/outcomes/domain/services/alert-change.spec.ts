import { alertChangeOf } from '@outcomes/domain/services/alert-change';
import { describe, expect, it } from 'vitest';

describe('alertChangeOf', () => {
  it('moves a rate in points, bad where a rise is worse', () => {
    expect(
      alertChangeOf('sent_back_rate', { value: 0.4, baseline: 0.2 }),
    ).toMatchObject({ unit: 'points', direction: 'up', tone: 'bad' });
  });

  it('reads a rate within rounding of the one before as the same', () => {
    expect(
      alertChangeOf('merged_rate', { value: 0.5, baseline: 0.5002 }),
    ).toMatchObject({ direction: 'same', tone: 'flat' });
  });

  it('moves cost per run in percent, good where it fell', () => {
    expect(
      alertChangeOf('cost_per_run', { value: 1, baseline: 2 }),
    ).toMatchObject({
      unit: 'percent',
      by: -0.5,
      direction: 'down',
      tone: 'good',
    });
  });

  it('gives no change without a baseline', () => {
    expect(
      alertChangeOf('failed_rate', { value: 0.3, baseline: null }),
    ).toBeNull();
  });
});
