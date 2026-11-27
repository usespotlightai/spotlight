import { render, screen, within } from '@testing-library/react';
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
        reading: 'chance',
      },
      confusion: {
        labels: ['fails', 'passes'],
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

  it('leads with whether judge verdicts show, then the figures as tiles', () => {
    showing();

    expect(
      document.querySelector('[data-slot="score-visibility"]'),
    ).toHaveTextContent('Judge verdicts show on runs.');
    expect(tiles()).toEqual([
      'Runs with both verdicts24Of 30 judged',
      'Cohen’s kappa0.71Substantial',
      'Same verdict88%21 of 24 runs',
    ]);
  });

  it('compares each claims version, current first, in rows that pick nothing', () => {
    showing();

    const table = screen.getByRole('list', {
      name: 'Agreement by claims version',
    });
    const rows = within(table)
      .getAllByRole('listitem')
      .filter((each) => each.dataset.slot === 'version-agreement');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/^Current claims/);
    expect(rows[1]).toHaveTextContent(/^Claims until /);
    expect(within(table).queryByRole('button')).toBeNull();
  });

  it('names the commit of each claims version, linked to its pull request or else to the commit', () => {
    const SHA = '3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f';
    const LATER = '9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b';
    answer.data = {
      ...JUDGE_AGREEMENT,
      versions: [
        {
          ...CURRENT,
          source: {
            repository: 'acme/spotlight-config',
            sha: SHA,
            shortSha: SHA.slice(0, 7),
            url: `https://github.com/acme/spotlight-config/commit/${SHA}`,
            pullRequest: {
              number: 42,
              url: 'https://github.com/acme/spotlight-config/pull/42',
              title: 'Tighten the implementation claims',
            },
          },
        },
        {
          ...EARLIER,
          source: {
            repository: 'acme/spotlight-config',
            sha: LATER,
            shortSha: LATER.slice(0, 7),
            url: `https://github.com/acme/spotlight-config/commit/${LATER}`,
            pullRequest: null,
          },
        },
        { ...EARLIER, rubricVersion: 'f'.repeat(64), source: null },
      ],
    };
    showing();

    const rows = within(
      screen.getByRole('list', { name: 'Agreement by claims version' }),
    )
      .getAllByRole('listitem')
      .filter((each) => each.dataset.slot === 'version-agreement');
    const current = within(rows[0]).getByRole('link', {
      name: '3f1c9a7',
    });
    const earlier = within(rows[1]).getByRole('link', {
      name: '9b8a7c6',
    });

    expect(current).toHaveAttribute(
      'href',
      'https://github.com/acme/spotlight-config/pull/42',
    );
    expect(current).toHaveAttribute('target', '_blank');
    expect(current).toHaveAttribute(
      'title',
      'Tighten the implementation claims',
    );
    expect(
      rows[0]?.querySelector('[data-slot="version-label"]'),
    ).toHaveTextContent(/^3f1c9a7Current$/);
    expect(earlier).toHaveAttribute(
      'href',
      `https://github.com/acme/spotlight-config/commit/${LATER}`,
    );
    expect(
      rows[1]?.querySelector('[data-slot="version-label"]'),
    ).toHaveTextContent(/^9b8a7c6$/);
    expect(within(rows[2]).queryByRole('link')).toBeNull();
    expect(rows[2]).toHaveTextContent(/^Claims until /);
  });

  it('leaves out the version table where the claims never changed', () => {
    answer.data = {
      ...JUDGE_AGREEMENT,
      versions: JUDGE_AGREEMENT.versions.slice(0, 1),
    };
    showing();

    expect(
      screen.queryByRole('list', { name: 'Agreement by claims version' }),
    ).not.toBeInTheDocument();
  });

  it('shows where the verdicts differ with their totals, and who gave a verdict on the last runs', () => {
    showing();

    const { coverage } = JUDGE_AGREEMENT;
    expect(
      screen.getByRole('heading', {
        name: `Verdicts on the last ${coverage.runs} runs`,
      }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="judge-coverage"] dl')?.textContent,
    ).toContain(`Both${coverage.both}`);
    expect(
      screen.getAllByRole('columnheader').map((each) => each.textContent),
    ).toEqual(['People', 'Judge', 'Failed', 'Passed', 'Total']);
    expect(
      [
        ...document.querySelectorAll(
          '[data-slot="confusion-matrix"] td[data-agree="false"]',
        ),
      ].length,
    ).toBe(2);
    expect(
      screen.getByText(
        'No trend yet. It shows at 30 runs with both verdicts, on more than one day.',
      ),
    ).toBeInTheDocument();
  });

  it('shows no agreement figures while too few runs have both verdicts', () => {
    answer.data = withFewPairs();
    showing();

    expect(
      document.querySelector('[data-slot="score-visibility"]'),
    ).toHaveTextContent(/^Judge verdicts are hidden on runs\.$/);
    expect(tiles()).toEqual([
      'Runs with both verdicts3 of 10Kappa and same verdict show at 10 runs.',
    ]);
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
  });

  it('shows the current claims, and earlier ones picked from the dropdown', async () => {
    showing();

    expect(tiles()[1]).toMatch(/^Cohen’s kappa/);

    await userEvent.click(screen.getByRole('button', { name: 'Claims' }));
    expect(
      (await screen.findAllByRole('menuitemradio')).map(
        (each) => each.textContent,
      ),
    ).toEqual(['Current claims', expect.stringMatching(/^Claims until /)]);
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: /^Claims until / }),
    );

    expect(tiles()).toEqual([
      `Runs with both verdicts${EARLIER.agreement.pairs} of 10Kappa and same verdict show at 10 runs.`,
    ]);
    expect(
      document.querySelector('[data-slot="score-visibility"]'),
    ).not.toBeInTheDocument();
  });
});
