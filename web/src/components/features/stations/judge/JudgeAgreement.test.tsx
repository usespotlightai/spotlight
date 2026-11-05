import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { JudgeAgreement } from '@/components/features/stations/judge/JudgeAgreement';
import { JUDGE_AGREEMENT } from '@/test/fixtures/station';

vi.mock('@/hooks/api/useStationJudge', () => ({
  useStationJudge: () => ({
    data: JUDGE_AGREEMENT,
    isPending: false,
    isFetching: false,
    errorUpdateCount: 0,
    error: null,
    refetch: vi.fn(),
  }),
}));

const statistics = () =>
  document.querySelector('[data-slot="judge-statistics"]')?.textContent;

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

describe('JudgeAgreement', () => {
  it('shows who scored the last runs, where the scores differ with their totals, and when the trend shows', () => {
    showing();

    const { coverage } = JUDGE_AGREEMENT;
    expect(
      screen.getByRole('heading', {
        name: `Who scored the last ${coverage.runs} runs`,
      }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="judge-coverage"] dl')?.textContent,
    ).toContain(`Both scores${coverage.both}`);
    expect(
      screen.getAllByRole('columnheader').map((each) => each.textContent),
    ).toEqual(['Judge said', 'People said', 'no', 'yes', 'Total']);
    expect(
      [
        ...document.querySelectorAll(
          '[data-slot="confusion-matrix"] td[data-agree="false"]',
        ),
      ].length,
    ).toBe(2);
    expect(
      screen.getByText(/^The trend shows once 30 runs on this rubric/),
    ).toHaveTextContent('24 have so far.');
  });

  it('shows the current rubric version, and an earlier one picked from the dropdown', async () => {
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

    expect(statistics()).toMatch(/^Cohen’s kappa/);

    await userEvent.click(screen.getByRole('button', { name: 'Rubric' }));
    expect(
      (await screen.findAllByRole('menuitemradio')).map(
        (each) => each.textContent,
      ),
    ).toEqual(['Current version', expect.stringMatching(/^Version until /)]);
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: /^Version until / }),
    );

    expect(statistics()).toMatch(/^Pearson correlation/);
  });
});
