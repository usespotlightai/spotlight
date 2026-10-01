import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JudgeTrend } from '@/components/features/stations/judge/JudgeTrend';

const judgeLegend = () =>
  document.querySelector('[data-slot="judge-trend-judge"]');

describe('JudgeTrend', () => {
  it('names the judge’s line where the judge is shown', () => {
    render(
      <JudgeTrend
        kind="yes-no"
        trend={[
          {
            day: '2026-09-30',
            judged: 4,
            judge: 0.75,
            labelled: 3,
            people: 0.67,
          },
        ]}
      />,
    );

    expect(judgeLegend()).toHaveTextContent(/^Judge$/);
  });

  it('says the judge is hidden where its scores are left out', () => {
    render(
      <JudgeTrend
        kind="yes-no"
        trend={[
          {
            day: '2026-09-30',
            judged: 4,
            judge: null,
            labelled: 3,
            people: 0.67,
          },
        ]}
      />,
    );

    expect(judgeLegend()).toHaveTextContent('Judge hidden');
  });
});
