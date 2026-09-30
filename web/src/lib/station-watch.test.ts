import { describe, expect, it } from 'vitest';
import {
  type AlertThreshold,
  alertPhrase,
  sharePercent,
} from '@/lib/station-watch';

const alert = (
  measure: AlertThreshold['measure'],
  set: Partial<AlertThreshold>,
): AlertThreshold => ({
  measure,
  risesBy: null,
  above: null,
  fallsBy: null,
  below: null,
  over: 20,
  ...set,
});

describe('alertPhrase', () => {
  it('says a rate rising in percentage points against the runs before', () => {
    expect(alertPhrase(alert('sent_back_rate', { risesBy: 0.2 }))).toBe(
      'Sent-back rate up 20 points in the last 20 runs, against the 20 before',
    );
  });

  it('says a rate falling in percentage points against the runs before', () => {
    expect(alertPhrase(alert('accepted_rate', { fallsBy: 0.1 }))).toBe(
      'Accepted rate down 10 points in the last 20 runs, against the 20 before',
    );
  });

  it('says a cost rising or falling in dollars', () => {
    expect(alertPhrase(alert('cost_per_run', { risesBy: 0.5, over: 10 }))).toBe(
      'Cost per run up $0.50 in the last 10 runs, against the 10 before',
    );
    expect(alertPhrase(alert('cost_per_run', { fallsBy: 0.5, over: 10 }))).toBe(
      'Cost per run down $0.50 in the last 10 runs, against the 10 before',
    );
  });

  it('says a cost going above an amount across the last runs', () => {
    expect(alertPhrase(alert('cost_per_run', { above: 2, over: 10 }))).toBe(
      'Cost per run above $2.00 across the last 10 runs',
    );
  });

  it('says a rate going below a percentage across the last runs', () => {
    expect(alertPhrase(alert('merged_rate', { below: 0.4 }))).toBe(
      'Merged rate below 40% across the last 20 runs',
    );
  });

  it('says one run as the last run', () => {
    expect(alertPhrase(alert('failed_rate', { above: 0.125, over: 1 }))).toBe(
      'Failed rate above 12.5% across the last run',
    );
    expect(alertPhrase(alert('failed_rate', { risesBy: 0.01, over: 1 }))).toBe(
      'Failed rate up 1 point in the last run, against the one before',
    );
  });
});

describe('sharePercent', () => {
  it('shows a share as a percentage', () => {
    expect(sharePercent(0.6)).toBe('60%');
  });
});
