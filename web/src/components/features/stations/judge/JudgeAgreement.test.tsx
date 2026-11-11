import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JudgeAgreement } from '@/components/features/stations/judge/JudgeAgreement';
import type { StationJudgeAgreement } from '@/lib/judge';
import { JUDGE_AGREEMENT } from '@/test/fixtures/station';

const answer = vi.hoisted(() => ({
  data: null as StationJudgeAgreement | null,
}));

vi.mock('@/hooks/api/useStationJudge', () => ({
  useStationJudge: () => ({
    data: answer.data,
    isPending: false,
    isFetching: false,
    errorUpdateCount: 0,
    error: null,
    refetch: vi.fn(),
  }),
}));

const tiles = () =>
  [
    ...document.querySelectorAll(
      '[data-slot="judge-statistics"] [data-slot="insights-tile"]',
    ),
  ].map((each) => each.textContent);

const showing = () =>
  render(
    <MemoryRouter>
      <JudgeAgreement
        slug="acme"
        teamId="team_1"
        lineId="line_1"
        stationId="station_1"
      />
    </MemoryRouter>,
  );

const [CURRENT, EARLIER] = JUDGE_AGREEMENT.versions;

const withFewPairs = (): StationJudgeAgreement => ({
  ...JUDGE_AGREEMENT,
  calibration: {
    ...JUDGE_AGREEMENT.calibration,
    qualified: false,
    agreement: 0,
    reading: 'chance',
    pairs: 3,
    hiddenReason: 'too-few-pairs',
  },
  versions: [
    {
      ...CURRENT,
      judged: 3,
      agreement: {
        ...CURRENT.agreement,
        pairs: 3,
        measured: false,
        pairsProgress: 0.3,
        agreed: 0,
        compared: 3,
        kappa: 0,
        observed: 0,
        f1: 0,
        readings: { kappa: 'chance', pearson: null, spearman: null },
      },
      confusion: {
        labels: ['no', 'yes'],
        cells: [
          [0, 3],
          [0, 0],
        ],
      },
      trend: [],
    },
  ],
});

describe('JudgeAgreement', () => {
  beforeEach(() => {
    answer.data = JUDGE_AGREEMENT;
  });

  it('leads with whether judge scores show, then the figures as tiles', () => {
    showing();

    expect(
      document.querySelector('[data-slot="score-visibility"]'),
    ).toHaveTextContent('Judge scores show on runs.');
    expect(tiles()).toEqual([
      'Runs both scored24Of 30 judged',
      'Cohen’s kappa0.71Substantial',
      'Same score88%21 of 24 runs',
      'F1 score0.91',
    ]);
  });

  it('shows where the scores differ with their totals, and who scored the last runs', () => {
    showing();

    const { coverage } = JUDGE_AGREEMENT;
    expect(
      screen.getByRole('heading', {
        name: `Last ${coverage.runs} runs by scorer`,
      }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="judge-coverage"] dl')?.textContent,
    ).toContain(`Both scores${coverage.both}`);
    expect(
      screen.getAllByRole('columnheader').map((each) => each.textContent),
    ).toEqual(['People', 'Judge', 'No', 'Yes', 'Total']);
    expect(
      [
        ...document.querySelectorAll(
          '[data-slot="confusion-matrix"] td[data-agree="false"]',
        ),
      ].length,
    ).toBe(2);
    expect(
      screen.getByText(
        'No trend yet. It shows at 30 runs with both scores, on more than one day.',
      ),
    ).toBeInTheDocument();
  });

  it('shows no agreement figures while too few runs have both scores', () => {
    answer.data = withFewPairs();
    showing();

    expect(
      document.querySelector('[data-slot="score-visibility"]'),
    ).toHaveTextContent(/^Judge scores are hidden on runs\.$/);
    expect(tiles()).toEqual([
      'Runs both scored3 of 10Kappa, same score and F1 show at 10 runs.',
    ]);
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
  });

  it('shows the current rubric version, and an earlier one picked from the dropdown', async () => {
    showing();

    expect(tiles()[1]).toMatch(/^Cohen’s kappa/);

    await userEvent.click(screen.getByRole('button', { name: 'Rubric' }));
    expect(
      (await screen.findAllByRole('menuitemradio')).map(
        (each) => each.textContent,
      ),
    ).toEqual(['Current rubric', expect.stringMatching(/^Rubric until /)]);
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: /^Rubric until / }),
    );

    expect(tiles()).toEqual([
      `Runs both scored${EARLIER?.agreement.pairs} of 10Correlations and errors show at 10 runs.`,
    ]);
    expect(
      document.querySelector('[data-slot="score-visibility"]'),
    ).not.toBeInTheDocument();
  });
});
