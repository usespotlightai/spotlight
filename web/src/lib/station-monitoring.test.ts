import { describe, expect, it } from 'vitest';
import {
  type AlertRule,
  alertFace,
  alertPhrase,
  sharePercent,
} from '@/lib/station-monitoring';

const alert = (
  measure: AlertRule['measure'],
  set: Partial<AlertRule>,
): AlertRule => ({
  measure,
  risesBy: null,
  above: null,
  fallsBy: null,
  below: null,
  over: 20,
  ...set,
});

describe('alertPhrase', () => {
  it('says the alert fires on a rate rising by percentage points or more', () => {
    expect(alertPhrase(alert('sent_back_rate', { risesBy: 0.2 }))).toBe(
      'Alerts when the sent-back rate rises 20 points or more over 20 runs',
    );
  });

  it('says the alert fires on a rate falling by percentage points or more', () => {
    expect(alertPhrase(alert('accepted_rate', { fallsBy: 0.1 }))).toBe(
      'Alerts when the accepted rate falls 10 points or more over 20 runs',
    );
  });

  it('says a cost rising or falling as a bare amount, since a threshold names no currency', () => {
    expect(alertPhrase(alert('cost_per_run', { risesBy: 0.5, over: 10 }))).toBe(
      'Alerts when the cost per run rises 0.50 or more over 10 runs',
    );
    expect(alertPhrase(alert('cost_per_run', { fallsBy: 0.5, over: 10 }))).toBe(
      'Alerts when the cost per run falls 0.50 or more over 10 runs',
    );
  });

  it('says a cost going above an amount over the runs, in the runs’ currency where known', () => {
    expect(alertPhrase(alert('cost_per_run', { above: 2, over: 10 }))).toBe(
      'Alerts when the cost per run goes above 2.00 over 10 runs',
    );
    expect(
      alertPhrase(alert('cost_per_run', { above: 2, over: 10 }), 'USD'),
    ).toBe('Alerts when the cost per run goes above $2.00 over 10 runs');
  });

  it('says a rate dropping below a percentage over the runs', () => {
    expect(alertPhrase(alert('merged_rate', { below: 0.4 }))).toBe(
      'Alerts when the merged rate drops below 40% over 20 runs',
    );
  });

  it('says one run as a single run, and a change from one run to the next', () => {
    expect(alertPhrase(alert('failed_rate', { above: 0.125, over: 1 }))).toBe(
      'Alerts when the failed rate goes above 12.5% in a single run',
    );
    expect(alertPhrase(alert('failed_rate', { risesBy: 0.01, over: 1 }))).toBe(
      'Alerts when the failed rate rises 1 point or more from one run to the next',
    );
  });
});

describe('alertFace', () => {
  it('shows a rate change in signed points over its window', () => {
    expect(alertFace(alert('sent_back_rate', { risesBy: 0.2 }))).toEqual({
      measure: 'Sent-back rate',
      condition: 'rises',
      threshold: '+20 pts',
      window: 'over 20 runs',
    });
    expect(alertFace(alert('accepted_rate', { fallsBy: 0.1 }))).toEqual({
      measure: 'Accepted rate',
      condition: 'falls',
      threshold: '−10 pts',
      window: 'over 20 runs',
    });
  });

  it('shows a level as a bound, a cost as a bare amount', () => {
    expect(
      alertFace(alert('cost_per_run', { above: 2, over: 10 })).threshold,
    ).toBe('> 2.00');
    expect(alertFace(alert('merged_rate', { below: 0.5, over: 1 }))).toEqual({
      measure: 'Merged rate',
      condition: 'below',
      threshold: '< 50%',
      window: 'in a single run',
    });
  });
});

describe('sharePercent', () => {
  it('shows a share as a percentage', () => {
    expect(sharePercent(0.6)).toBe('60%');
  });
});
