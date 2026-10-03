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

const renderDialog = (baselineRepeats: number | null) =>
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

describe('StartReplayDialog', () => {
  beforeEach(() => mutate.mockReset());

  it('offers the live config and the proposed candidates', () => {
    renderDialog(1);

    expect(screen.getByRole('radio', { name: /Live config/ })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /Shorter prompt/ }),
    ).toBeInTheDocument();
  });

  it('says a live replay becomes the new baseline where the set’s runs changed since its baseline', () => {
    renderDialog(1);

    expect(
      screen.getByText(
        /this replay of the live config becomes the new baseline/,
      ),
    ).toBeInTheDocument();
  });

  it('explains that a baseline also starts, spending its own ceiling, when a candidate replays a set with none', async () => {
    renderDialog(null);

    expect(
      screen.getByText(/this replay of the live config becomes it/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/twice it/)).toBeNull();

    await userEvent.click(
      screen.getByRole('radio', { name: /Shorter prompt/ }),
    );

    expect(screen.getByText(/may spend up to twice it/)).toBeInTheDocument();
  });

  it('says a new baseline starts when the set’s baseline copied each run fewer times than asked', async () => {
    renderDialog(1);

    const repeats = screen.getByRole('textbox', { name: 'Repeats' });
    await userEvent.clear(repeats);
    await userEvent.type(repeats, '3');

    expect(
      screen.getByText(
        /The set’s baseline replays each run once, fewer than this replay, so this replay of the live config becomes the new baseline/,
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('radio', { name: /Shorter prompt/ }),
    );

    expect(
      screen.getByText(
        /a new baseline of the live config also starts beside it, replaying each run 3 times/,
      ),
    ).toBeInTheDocument();
  });

  it('refuses a ceiling of nothing, saying why', async () => {
    renderDialog(1);

    await userEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Give a ceiling above nothing.',
    );
  });

  it('starts the chosen candidate within the ceiling', async () => {
    renderDialog(1);

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

  it('replays each run as many times as asked, from 1 to 5', async () => {
    renderDialog(1);

    const repeats = screen.getByRole('textbox', { name: 'Repeats' });
    await userEvent.type(screen.getByLabelText('Most it may spend'), '5');
    await userEvent.clear(repeats);
    await userEvent.type(repeats, '6');
    await userEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Give a whole number from 1 to 5.',
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
