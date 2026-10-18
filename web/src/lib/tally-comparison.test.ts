import { describe, expect, it } from 'vitest';
import { comparedRows, type MeasureVerdict } from '@/lib/tally-comparison';

const verdict = (over: Partial<MeasureVerdict>): MeasureVerdict => ({
  measure: 'accepted_rate',
  before: 0.4,
  after: 0.6,
  measuredBefore: 10,
  measuredAfter: 10,
  currency: null,
  verdict: 'better',
  change: null,
  ...over,
});

const row = (rows: ReturnType<typeof comparedRows>, id: string) =>
  rows.find((each) => each.id === id);

describe('comparedRows', () => {
  it('shows the runs on each side, then each measure side by side in the tone the server judged', () => {
    const rows = comparedRows({ one: 12, other: 9 }, [
      verdict({}),
      verdict({
        measure: 'sent_back_rate',
        before: 0.2,
        after: 0.4,
        verdict: 'worse',
        change: {
          unit: 'points',
          by: 0.2,
          fromZero: false,
          direction: 'up',
          tone: 'flat',
        },
      }),
    ]);

    expect(row(rows, 'runs')).toMatchObject({
      one: '12',
      other: '9',
      delta: null,
    });
    expect(row(rows, 'accepted_rate')).toMatchObject({
      label: 'Accepted rate',
      one: '40%',
      other: '60%',
      delta: { tone: 'good' },
    });
    expect(row(rows, 'sent_back_rate')).toMatchObject({
      delta: { shown: '+20 pts', tone: 'bad' },
    });
  });

  it('takes a rise for good or bad only on the server’s word', () => {
    const rows = comparedRows({ one: 10, other: 10 }, [
      verdict({
        measure: 'failed_rate',
        before: 0.1,
        after: 0.3,
        verdict: 'better',
      }),
    ]);

    expect(row(rows, 'failed_rate')?.delta?.tone).toBe('good');
  });

  it('says too few runs are measured rather than showing a change, and prices a run in its currency', () => {
    const rows = comparedRows({ one: 3, other: 2 }, [
      verdict({
        measure: 'cost_per_run',
        before: 0.5,
        after: 0.25,
        currency: 'USD',
        verdict: 'insufficient',
      }),
      verdict({
        measure: 'merged_rate',
        before: null,
        after: null,
        verdict: 'insufficient',
      }),
    ]);

    expect(row(rows, 'cost_per_run')).toMatchObject({
      one: '$0.50',
      other: '$0.25',
      delta: { shown: 'Too few runs', tone: 'flat' },
    });
    expect(row(rows, 'merged_rate')).toMatchObject({ one: '–', other: '–' });
  });
});
