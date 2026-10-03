import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { MemoryFilterMenu } from '@/components/features/memory/MemoryFilterMenu';

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [
      {
        id: 'line_delivery',
        key: 'delivery',
        name: 'Delivery',
        stations: [
          { id: 'station_build', name: 'Implementation', kind: 'work' },
        ],
        reactions: [],
        repositories: ['acme/api'],
      },
    ],
  }),
}));

function Where() {
  const location = useLocation();
  return <output aria-label="Where">{location.search}</output>;
}

const showing = (at = '/w/acme/team/team_1/memory') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/memory"
          element={
            <>
              <MemoryFilterMenu teamId="team_1" />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const where = () => screen.getByRole('status', { name: 'Where' });

describe('MemoryFilterMenu', () => {
  it('keeps the filters out of the page until they are asked for', async () => {
    showing();

    expect(
      screen.queryByRole('button', { name: 'Kind: Every kind' }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Filter memories' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Kind: Every kind' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Station: Every station' }),
    ).toBeDisabled();
  });

  it('narrows the list to a kind, kept in the address', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Filter memories' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Kind: Every kind' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Failure' }),
    );

    expect(where()).toHaveTextContent('?kind=failure');
  });

  it('says how many filters are narrowing the list', () => {
    showing('/w/acme/team/team_1/memory?kind=failure&path=src');

    expect(
      screen.getByRole('button', { name: 'Filter memories, 2 applied' }),
    ).toHaveTextContent('2');
  });

  it('shows what the address already narrows by', async () => {
    showing('/w/acme/team/team_1/memory?path=.');

    await userEvent.click(
      screen.getByRole('button', { name: 'Filter memories, 1 applied' }),
    );

    expect(await screen.findByRole('textbox', { name: 'Path' })).toHaveValue(
      '.',
    );
  });

  it('clears every filter at once, keeping which memories are shown', async () => {
    showing(
      '/w/acme/team/team_1/memory?standing=retired&kind=failure&path=src',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Filter memories, 2 applied' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Clear filters' }),
    );

    expect(where()).toHaveTextContent('?standing=retired');
    expect(
      screen.getByRole('button', { name: 'Filter memories' }),
    ).toBeInTheDocument();
  });
});
