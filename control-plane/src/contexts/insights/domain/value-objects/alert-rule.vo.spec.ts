import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { describe, expect, it } from 'vitest';

describe('AlertRule', () => {
  it('fires on a rise of at least its threshold against the runs before', () => {
    const rule = AlertRule.of({
      measure: 'sent_back_rate',
      risesBy: 0.2,
      over: 5,
    });

    expect(rule.crossedBy({ value: 0.6, baseline: 0.4 })).toBe(true);
    expect(rule.crossedBy({ value: 0.5, baseline: 0.4 })).toBe(false);
    expect(rule.crossedBy({ value: 0.2, baseline: 0.6 })).toBe(false);
  });

  it('fires on a fall of at least its threshold against the runs before', () => {
    const rule = AlertRule.of({
      measure: 'accepted_rate',
      fallsBy: 0.1,
      over: 3,
    });

    expect(rule.crossedBy({ value: 0.5, baseline: 0.6 })).toBe(true);
    expect(rule.crossedBy({ value: 0.6, baseline: 0.6 })).toBe(false);
  });

  it('fires past a level, and not on it', () => {
    const above = AlertRule.of({ measure: 'cost_per_run', above: 2, over: 3 });
    const below = AlertRule.of({ measure: 'merged_rate', below: 0.5, over: 3 });

    expect(above.crossedBy({ value: 2.5, baseline: null })).toBe(true);
    expect(above.crossedBy({ value: 2, baseline: null })).toBe(false);
    expect(below.crossedBy({ value: 0.4, baseline: null })).toBe(true);
    expect(below.crossedBy({ value: 0.5, baseline: null })).toBe(false);
  });

  it('needs twice its runs to compare a rise or fall, and its runs alone for a level', () => {
    expect(
      AlertRule.of({ measure: 'failed_rate', risesBy: 0.1, over: 4 })
        .runsNeeded,
    ).toBe(8);
    expect(
      AlertRule.of({ measure: 'failed_rate', above: 0.1, over: 4 }).runsNeeded,
    ).toBe(4);
  });

  it('is told apart by its measure and its condition, whatever threshold it has', () => {
    const rule = AlertRule.of({ measure: 'failed_rate', above: 0.1, over: 4 });
    const reset = AlertRule.of({ measure: 'failed_rate', above: 0.2, over: 5 });

    expect(rule.equals(reset)).toBe(true);
    expect(rule.setAlike(reset)).toBe(false);
    expect(
      rule.setAlike(
        AlertRule.of({ measure: 'failed_rate', above: 0.1, over: 4 }),
      ),
    ).toBe(true);
    expect(
      rule.equals(
        AlertRule.of({ measure: 'failed_rate', below: 0.1, over: 4 }),
      ),
    ).toBe(false);
    expect(
      rule.equals(
        AlertRule.of({ measure: 'sent_back_rate', above: 0.1, over: 4 }),
      ),
    ).toBe(false);
  });

  it('rejects an unknown measure, two conditions at once, or a broken count of runs', () => {
    expect(() => AlertRule.of({ measure: 'joy', above: 1, over: 1 })).toThrow(
      /measure must be one of/,
    );
    expect(() =>
      AlertRule.of({ measure: 'failed_rate', above: 0.1, below: 0.2, over: 1 }),
    ).toThrow(/exactly one/);
    expect(() =>
      AlertRule.of({ measure: 'failed_rate', above: 0.1, over: 0 }),
    ).toThrow(/run count must be a whole number/);
  });
});
