import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartReplayDialog } from '@/components/features/replays/set/StartReplayDialog';
import type { ReplaySet } from '@/lib/replay';

const mutate = vi.fn();

vi.mock('@/hooks/api/useStartReplay', () => ({
  useStartReplay: () => ({
    mutate,
    isPending: false,
    isError: false,
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useStationCandidates', () => ({
  useStationCandidates: () => ({
    address: 'core/delivery/build',
    addressFailed: false,
    candidates: {
      data: [
        {
          id: 'candidate_1',
          name: 'Shorter prompt',
          kind: 'proposed',
          fingerprint: 'abcdef1234',
          createdAt: '2026-10-01T09:00:00.000Z',
        },
      ],
      isPending: false,
      errorUpdateCount: 0,
    },
  }),
}));

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const SET = {
  id: 'set_1',
  name: 'Queue fixes',
  entries: [{}, {}],
} as ReplaySet;

const renderDialog = (hasBaseline: boolean) =>
  render(
    <MemoryRouter>
      <StartReplayDialog
        at={AT}
        set={SET}
        hasBaseline={hasBaseline}
        open
        onOpenChange={vi.fn()}
      />
    </MemoryRouter>,
  );

describe('StartReplayDialog', () => {
  beforeEach(() => mutate.mockReset());

  it('offers the live config and the proposed candidates', () => {
    renderDialog(true);

    expect(screen.getByRole('radio', { name: /Live config/ })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /Shorter prompt/ }),
    ).toBeInTheDocument();
  });

  it('says a live replay becomes the new baseline where the set’s runs changed since its baseline', () => {
    renderDialog(true);

    expect(
      screen.getByText(
        /this replay of the live config becomes the new baseline/,
      ),
    ).toBeInTheDocument();
  });

  it('explains that a baseline also starts, spending its own ceiling, when a candidate replays a set with none', async () => {
    renderDialog(false);

    expect(
      screen.getByText(/this replay of the live config becomes it/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/twice it/)).toBeNull();

    await userEvent.click(
      screen.getByRole('radio', { name: /Shorter prompt/ }),
    );

    expect(screen.getByText(/may spend up to twice it/)).toBeInTheDocument();
  });

  it('refuses a ceiling of nothing, saying why', async () => {
    renderDialog(true);

    await userEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Give a ceiling above nothing.',
    );
  });

  it('starts the chosen candidate within the ceiling', async () => {
    renderDialog(true);

    await userEvent.click(
      screen.getByRole('radio', { name: /Shorter prompt/ }),
    );
    await userEvent.type(screen.getByLabelText('Most it may spend'), '7.5');
    await userEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(mutate).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        setId: 'set_1',
        candidate: 'candidate_1',
        ceiling: { amount: 7.5, currency: 'USD' },
      },
      expect.anything(),
    );
  });
});
