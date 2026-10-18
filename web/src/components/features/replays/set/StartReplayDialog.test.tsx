import { render, screen, waitFor } from '@testing-library/react';
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
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useStationCandidates', () => ({
  useStationCandidates: () => ({
    path: 'core/delivery/build',
    pathFailed: false,
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

const openDialog = async (baselineRepeats: number | null) => {
  render(
    <MemoryRouter>
      <StartReplayDialog
        at={AT}
        set={SET}
        baseline={
          baselineRepeats === null ? null : { repeats: baselineRepeats }
        }
        open
        onOpenChange={vi.fn()}
      />
    </MemoryRouter>,
  );

  await waitFor(() =>
    expect(screen.getByRole('radio', { name: /Live config/ })).toHaveFocus(),
  );
};

describe('StartReplayDialog', () => {
  beforeEach(() => mutate.mockReset());

  it('offers the live config and the proposed candidates', async () => {
    await openDialog(1);

    expect(screen.getByRole('radio', { name: /Live config/ })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /Shorter prompt/ }),
    ).toBeInTheDocument();
  });

  it('says a live replay becomes the new baseline where the set’s runs changed since its baseline', async () => {
    await openDialog(1);

    expect(
      screen.getByText(/this replay becomes the new baseline/),
    ).toBeInTheDocument();
  });

  it('explains that a baseline also starts, spending its own ceiling, when a candidate replays a set with none', async () => {
    await openDialog(null);

    expect(
      screen.getByText(/This replay of the live config becomes the baseline/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/twice this ceiling/)).toBeNull();

    await userEvent.click(
      screen.getByRole('radio', { name: /Shorter prompt/ }),
    );

    expect(
      screen.getByText(/both replays can spend up to twice this ceiling/),
    ).toBeInTheDocument();
  });

  it('says a new baseline starts when the set’s baseline copied each run fewer times than requested', async () => {
    await openDialog(1);

    const repeats = screen.getByRole('textbox', { name: 'Repeats' });
    await userEvent.clear(repeats);
    await userEvent.type(repeats, '3');

    expect(
      screen.getByText(
        /The set’s baseline replays each run once\. This replay repeats each run more often\. This replay of the live config becomes the new baseline/,
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('radio', { name: /Shorter prompt/ }),
    );

    expect(
      screen.getByText(
        /A new baseline that replays each run 3 times also starts/,
      ),
    ).toBeInTheDocument();
  });

  it('rejects a ceiling of nothing, saying why', async () => {
    await openDialog(1);

    await userEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please enter a ceiling above 0.',
    );
  });

  it('starts the chosen candidate within the ceiling', async () => {
    await openDialog(1);

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
        repeats: 1,
      },
      expect.anything(),
    );
  });

  it('replays each run as many times as requested, from 1 to 5', async () => {
    await openDialog(1);

    const repeats = screen.getByRole('textbox', { name: 'Repeats' });
    await userEvent.type(screen.getByLabelText('Most it may spend'), '5');
    await userEvent.clear(repeats);
    await userEvent.type(repeats, '6');
    await userEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please enter a whole number from 1 to 5.',
    );

    await userEvent.clear(repeats);
    await userEvent.type(repeats, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ candidate: 'live', repeats: 3 }),
      expect.anything(),
    );
  });
});
