import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamIndex } from '@/routes/TeamIndex';

const lines = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: lines(),
    isPending: lines() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

const renderIndex = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1']}>
      <Routes>
        <Route path="/w/:slug/team/:teamId">
          <Route index element={<TeamIndex />} />
          <Route path="lines/:lineId" element={<p>line board</p>} />
          <Route path=":section" element={<p>team section</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  lines.mockReset();
  failing.mockReturnValue(false);
  refetch.mockClear();
});

describe('TeamIndex', () => {
  it('holds the bar of the page while the lines load', () => {
    lines.mockReturnValue(undefined);

    const { container } = renderIndex();

    expect(
      screen.getByRole('status', { name: 'Loading the team' }),
    ).toBeInTheDocument();
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('sends the caller to the first line', () => {
    lines.mockReturnValue([{ id: 'line_1' }, { id: 'line_2' }]);

    renderIndex();

    expect(screen.getByText('line board')).toBeInTheDocument();
  });

  it('falls back to the runs of a team with no lines', () => {
    lines.mockReturnValue([]);

    renderIndex();

    expect(screen.getByText('team section')).toBeInTheDocument();
  });

  it('says the lines could not be loaded, and tries again when asked', async () => {
    lines.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    renderIndex();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The lines could not be loaded.',
    );
    expect(screen.queryByText('team section')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });
});
