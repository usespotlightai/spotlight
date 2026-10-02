import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardsChangesToggle } from '@/components/features/replays/set/GuardsChangesToggle';
import type { ReplaySet } from '@/lib/replay';

const mutate = vi.fn();
const error = vi.fn((): unknown => null);

vi.mock('@/hooks/api/useGuardChanges', () => ({
  useGuardChanges: () => ({
    mutate,
    isPending: false,
    isError: error() !== null,
    error: error(),
  }),
}));

const SET: ReplaySet = {
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  name: 'Queue fixes',
  createdAt: '2026-10-01T09:00:00.000Z',
  stationGone: false,
  guardsChanges: false,
  entries: [],
};

describe('GuardsChangesToggle', () => {
  beforeEach(() => {
    mutate.mockClear();
    error.mockReturnValue(null);
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
        replayCheck={{ mostRegressions: 2, ceiling: 10, currency: 'USD' }}
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

    expect(
      screen.getByText(/The line sets no replay_check/),
    ).toBeInTheDocument();
  });

  it('explains that another set at the station guards its changes already', () => {
    error.mockReturnValue({ status: 409, detail: 'Guarded elsewhere' });

    render(
      <GuardsChangesToggle teamId="team_1" set={SET} replayCheck={null} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Another replay set at this station guards its changes already',
    );
  });
});
