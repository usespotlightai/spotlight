import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardsChangesToggle } from '@/components/features/replays/set/GuardsChangesToggle';
import type { ReplaySet } from '@/lib/replay';

const mutate = vi.fn();
vi.mock('@/hooks/api/useGuardChanges', () => ({
  useGuardChanges: () => ({ mutate, isPending: false }),
}));

const SET: ReplaySet = {
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  name: 'Queue fixes',
  createdAt: '2026-10-01T09:00:00.000Z',
  stationGone: false,
  guardsChanges: false,
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    sanity: null,
  },
  minGain: 0.05,
  composition: {
    outcomes: [
      { outcome: 'accepted', count: 0 },
      { outcome: 'sent-back', count: 0 },
      { outcome: 'asked', count: 0 },
      { outcome: 'failed', count: 0 },
      { outcome: 'other', count: 0 },
    ],
    origins: [],
    oldest: null,
    median: null,
    newest: null,
    balanceWarning: null,
  },
  entries: [],
};

describe('GuardsChangesToggle', () => {
  beforeEach(() => {
    mutate.mockClear();
  });

  it('turns guarding on for the set', () => {
    render(
      <GuardsChangesToggle teamId="team_1" set={SET} replayCheck={null} />,
    );

    const toggle = screen.getByRole('switch', {
      name: 'Guards config changes',
    });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    expect(mutate).toHaveBeenCalledWith({
      teamId: 'team_1',
      setId: 'set_1',
      guards: true,
    });
  });

  it('shows a guarded set as guarding', () => {
    render(
      <GuardsChangesToggle
        teamId="team_1"
        set={{ ...SET, guardsChanges: true }}
        replayCheck={{
          mostRegressions: 2,
          ceiling: 10,
          currency: 'USD',
          minGain: 0.05,
        }}
      />,
    );

    expect(
      screen.getByRole('switch', { name: 'Guards config changes' }),
    ).toBeChecked();
    expect(screen.getByText('2 regressions')).toBeInTheDocument();
  });

  it('says the line sets no threshold to check against', () => {
    render(
      <GuardsChangesToggle teamId="team_1" set={SET} replayCheck={null} />,
    );

    expect(screen.getByText(/Line sets no replay_check/)).toBeInTheDocument();
  });
});
