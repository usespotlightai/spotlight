import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { JudgeAgreement } from '@/components/features/stations/judge/JudgeAgreement';
import { JUDGE_AGREEMENT } from '@/stories/fixtures/station';

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

describe('JudgeAgreement', () => {
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

    await userEvent.click(
      screen.getByRole('button', { name: 'Rubric: Current version' }),
    );
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
